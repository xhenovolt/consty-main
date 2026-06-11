-- =============================================================================
-- MIGRATION 944: STAFF-USER IDENTITY INTEGRITY
-- Ensures every staff record is linked to a valid user account.
-- Adds role_id FK to users, unique constraint on username, and FK on
-- staff.user_id. Logs orphaned records to system_logs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add role_id FK to users (links user directly to RBAC roles table)
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

-- Backfill role_id by matching users.role (text) to roles.name
UPDATE users u
SET    role_id = r.id
FROM   roles r
WHERE  r.name = u.role
  AND  u.role_id IS NULL;

-- -----------------------------------------------------------------------------
-- 2. Ensure users.username has a UNIQUE constraint
--    (no duplicates exist to block this — verified before running)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  contype = 'u'
      AND  conrelid = 'users'::regclass
      AND  conname  = 'users_username_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Add FK constraint on staff.user_id → users.id
--    (staff.linked_user_id already has a FK; now enforce user_id as well)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  contype = 'f'
      AND  conrelid = 'staff'::regclass
      AND  conname  = 'fk_staff_user_id'
  ) THEN
    ALTER TABLE staff
      ADD CONSTRAINT fk_staff_user_id
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Make user_id the canonical link (sync from linked_user_id for existing rows)
UPDATE staff
SET    user_id = linked_user_id
WHERE  user_id        IS NULL
  AND  linked_user_id IS NOT NULL;

UPDATE staff
SET    linked_user_id = user_id
WHERE  linked_user_id IS NULL
  AND  user_id        IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Log orphaned staff records (staff without any user link) to system_logs
--    We do NOT auto-delete them — admins should create accounts via the UI.
-- -----------------------------------------------------------------------------
INSERT INTO system_logs (level, module, action, message, details)
SELECT
  'warn',
  'migration_944',
  'orphaned_staff',
  'Staff record found without linked user account',
  jsonb_build_object('staff_id', id::text, 'name', name, 'email', email)
FROM staff
WHERE user_id IS NULL
  AND linked_user_id IS NULL;

-- -----------------------------------------------------------------------------
-- 5. Mark orphaned staff so the UI can surface them clearly
-- -----------------------------------------------------------------------------
UPDATE staff
SET    account_status = 'requires_account'
WHERE  user_id IS NULL
  AND  linked_user_id IS NULL
  AND  (account_status IS NULL OR account_status = 'active');

-- -----------------------------------------------------------------------------
-- 6. Summary notice
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM staff WHERE user_id IS NULL AND linked_user_id IS NULL;
  RAISE NOTICE 'Migration 944 applied: staff-user identity integrity enforced. Orphaned staff records: %', orphan_count;
END $$;
