-- Migration 969: Identity architecture hardening.
--
-- ROOT CAUSE FIXED: `users_role_check` previously only allowed
-- ('superadmin','admin','user','viewer'). The /api/staff POST handler
-- wrote the dynamic role name (e.g. 'grapics_designer') into users.role,
-- causing a CHECK violation that rolled back the ENTIRE staff+user creation
-- transaction. This explains every "transaction rolled back" report.
--
-- Architecture:
--   `users.role` is now a coarse CLASS: superadmin | admin | staff | viewer | customer.
--   `users.role_id` is the source of truth for the actual role.
--
-- Idempotent.

-- ============================================================
-- 1. Drop the legacy narrow CHECK on users.role and replace
-- ============================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
  role IN ('superadmin','admin','staff','user','viewer','customer','system')
);

-- ============================================================
-- 2. Backfill: any user with a non-superadmin/admin/viewer legacy role
--    that doesn't match the new whitelist gets normalised to 'staff'
--    if they have a staff_id, else 'user'.
-- ============================================================
UPDATE users
   SET role = CASE
     WHEN role IN ('superadmin','admin','viewer','customer','system') THEN role
     WHEN staff_id IS NOT NULL THEN 'staff'
     ELSE 'user'
   END
 WHERE role NOT IN ('superadmin','admin','staff','user','viewer','customer','system');

-- ============================================================
-- 3. Eliminate the dual-pointer ambiguity on staff.
--    Both `user_id` and `linked_user_id` were FKs to users — code wrote one,
--    code read the other. Keep `user_id` as canonical; sync linked_user_id.
-- ============================================================
UPDATE staff SET linked_user_id = user_id
  WHERE user_id IS NOT NULL AND linked_user_id IS DISTINCT FROM user_id;
UPDATE staff SET user_id = linked_user_id
  WHERE user_id IS NULL AND linked_user_id IS NOT NULL;

-- Trigger to keep them mirrored (until linked_user_id can be dropped in a later migration)
CREATE OR REPLACE FUNCTION mirror_staff_user_id() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM NEW.linked_user_id THEN
    IF NEW.user_id IS NOT NULL AND NEW.linked_user_id IS NULL THEN
      NEW.linked_user_id := NEW.user_id;
    ELSIF NEW.linked_user_id IS NOT NULL AND NEW.user_id IS NULL THEN
      NEW.user_id := NEW.linked_user_id;
    ELSE
      -- Both set but different — prefer user_id as canonical
      NEW.linked_user_id := NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_staff_mirror_user_id ON staff;
CREATE TRIGGER trg_staff_mirror_user_id BEFORE INSERT OR UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION mirror_staff_user_id();

-- ============================================================
-- 4. Uniqueness: one user ↔ one staff
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_user_id
  ON staff(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_staff_id
  ON users(staff_id) WHERE staff_id IS NOT NULL;

-- ============================================================
-- 5. Health: orphan-detection view
-- ============================================================
CREATE OR REPLACE VIEW v_identity_orphans AS
SELECT
  u.id            AS user_id,
  u.email,
  u.username,
  u.role,
  u.staff_id,
  u.created_at,
  CASE
    WHEN u.role = 'superadmin'                                  THEN 'allowed'
    WHEN u.role IN ('viewer','customer','system')               THEN 'allowed'
    WHEN u.staff_id IS NULL                                     THEN 'phantom_user'
    WHEN NOT EXISTS (SELECT 1 FROM staff s WHERE s.id = u.staff_id) THEN 'dangling_staff_ref'
    ELSE 'linked'
  END AS issue
FROM users u;

CREATE OR REPLACE VIEW v_staff_orphans AS
SELECT
  s.id            AS staff_id,
  s.name,
  s.email,
  s.user_id,
  s.linked_user_id,
  CASE
    WHEN s.user_id IS NULL AND s.linked_user_id IS NULL              THEN 'staff_without_user'
    WHEN s.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.user_id) THEN 'dangling_user_ref'
    WHEN s.user_id IS DISTINCT FROM s.linked_user_id
         AND s.linked_user_id IS NOT NULL                            THEN 'pointer_mismatch'
    ELSE 'linked'
  END AS issue
FROM staff s;

-- ============================================================
-- 6. Identity health snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS identity_health_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  total_users     INTEGER NOT NULL,
  total_staff     INTEGER NOT NULL,
  phantom_users   INTEGER NOT NULL,
  staff_no_user   INTEGER NOT NULL,
  pointer_mismatches INTEGER NOT NULL,
  dangling_refs   INTEGER NOT NULL,
  orphan_sessions INTEGER NOT NULL,
  details         JSONB DEFAULT '{}'::jsonb,
  passed          BOOLEAN NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_identity_health_generated ON identity_health_reports(generated_at DESC);

-- ============================================================
-- 7. Identity audit log (separate from the generic audit_logs table
--    so that delete/archive/restore actions on identity entities
--    have a clean, queryable trail).
-- ============================================================
CREATE TABLE IF NOT EXISTS identity_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action          VARCHAR(40) NOT NULL,
  -- create_staff | delete_staff | archive_user | delete_user | repair_link
  -- restore_user | invalidate_sessions | role_change | department_change
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  staff_id        UUID REFERENCES staff(id) ON DELETE SET NULL,
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  reason          TEXT,
  before_state    JSONB,
  after_state     JSONB,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_identity_audit_user  ON identity_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_audit_staff ON identity_audit_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_identity_audit_when  ON identity_audit_logs(created_at DESC);

-- ============================================================
-- 8. Permissions for the new endpoints
-- ============================================================
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('identity','view_health',  'View identity health reports', '/api/admin/identity/health'),
  ('identity','repair',       'Repair orphan/phantom records', '/api/admin/identity/repair'),
  ('users','delete',          'Delete users (incl. phantoms)', '/api/users'),
  ('users','archive',         'Archive/disable users',         '/api/users')
ON CONFLICT DO NOTHING;
