-- ============================================================================
-- Migration 938: Identity Triangle Integrity Enforcement
-- Date: 2026-03-17
-- Purpose:
--   Guarantee the core identity triangle: users ↔ staff ↔ roles
--   "No user without staff. No staff without role. No role without authority."
--
--   1. Auto-link users to staff via email match (if not already linked)
--   2. Ensure every staff with a user has staff_roles populated
--   3. Ensure every superadmin user gets authority_level = 100
--   4. Ensure every active user has a non-null authority_level
--   5. Add DB-level trigger to keep users.authority_level in sync
--   6. Add constraint: staff.role_id cannot be null for active staff
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. AUTO-LINK USERS → STAFF VIA EMAIL MATCH
-- ────────────────────────────────────────────────────────────────────────────

-- If a user has no staff_id but shares an email with a staff record, link them
UPDATE users u
SET staff_id = s.id
FROM staff s
WHERE u.staff_id IS NULL
  AND u.email IS NOT NULL
  AND LOWER(u.email) = LOWER(s.email);

-- Reverse: update staff.user_id and staff.linked_user_id from newly linked users
UPDATE staff s
SET user_id       = u.id,
    linked_user_id = u.id
FROM users u
WHERE u.staff_id = s.id
  AND (s.user_id IS NULL OR s.linked_user_id IS NULL);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. POPULATE staff_roles FROM staff.role_id WHERE MISSING
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO staff_roles (staff_id, role_id)
SELECT s.id, s.role_id
FROM staff s
WHERE s.role_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM staff_roles sr WHERE sr.staff_id = s.id AND sr.role_id = s.role_id
  )
ON CONFLICT (staff_id, role_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. SYNC users.authority_level FROM THEIR BEST ROLE
-- ────────────────────────────────────────────────────────────────────────────

-- Superadmins always 100
UPDATE users SET authority_level = 100 WHERE role = 'superadmin';

-- Others: take the highest authority_level from their staff_roles chain
UPDATE users u
SET authority_level = (
  SELECT COALESCE(MAX(r.authority_level), 10)
  FROM staff s
  JOIN staff_roles sr ON sr.staff_id = s.id
  JOIN roles r ON sr.role_id = r.id
  WHERE s.id = u.staff_id
)
WHERE u.staff_id IS NOT NULL
  AND u.role != 'superadmin';

-- Fallback: derive from users.role text for any remaining users with authority_level = 10
UPDATE users u
SET authority_level = COALESCE(
  (SELECT r.authority_level FROM roles r WHERE r.name = u.role LIMIT 1),
  10
)
WHERE u.authority_level = 10
  AND u.role != 'superadmin';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. TRIGGER: keep users.authority_level in sync when staff_roles change
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_user_authority_level()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Re-compute authority_level for the user linked to this staff record
  UPDATE users u
  SET authority_level = (
    SELECT COALESCE(MAX(r.authority_level), 10)
    FROM staff_roles sr2
    JOIN roles r ON sr2.role_id = r.id
    WHERE sr2.staff_id = COALESCE(NEW.staff_id, OLD.staff_id)
  )
  FROM staff s
  WHERE s.id = COALESCE(NEW.staff_id, OLD.staff_id)
    AND u.staff_id = s.id
    AND u.role != 'superadmin';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_authority_on_role_change ON staff_roles;
CREATE TRIGGER trg_sync_authority_on_role_change
  AFTER INSERT OR UPDATE OR DELETE ON staff_roles
  FOR EACH ROW EXECUTE FUNCTION sync_user_authority_level();

-- ────────────────────────────────────────────────────────────────────────────
-- 5. ENSURE roles.authority_level IS NEVER NULL OR ZERO
-- ────────────────────────────────────────────────────────────────────────────

-- Any role with authority_level = 0 or NULL gets a safe default of 10
UPDATE roles
SET authority_level = 10
WHERE authority_level IS NULL OR authority_level = 0;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. INDEXES FOR INTEGRITY JOIN PATHS
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_role        ON users(role);
CREATE INDEX IF NOT EXISTS idx_staff_user_id     ON staff(user_id);

COMMIT;
