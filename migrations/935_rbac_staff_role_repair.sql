-- ============================================================================
-- Migration 935: RBAC Staff-Role Relationship Repair
-- Date: 2026-03-16
-- Purpose:
--   Complete the transition from user_roles (direct user→role) to the correct
--   relational chain: users → staff → staff_roles → roles
--
--   Steps:
--   1. Ensure staff table has needed columns (email, department_id, name)
--   2. Ensure staff_roles table exists
--   3. Ensure users.staff_id column exists and is linked
--   4. For every user with no staff record → create one
--   5. Migrate user_roles into staff_roles (deduplicated)
--   6. Ensure every user with role='superadmin' has the superadmin role in staff_roles
-- Safety: All operations use IF NOT EXISTS guards and ON CONFLICT DO NOTHING
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. ENSURE staff TABLE HAS REQUIRED COLUMNS
-- ────────────────────────────────────────────────────────────────────────────

-- Add email column to staff if missing
ALTER TABLE staff ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Add name column (some migrations use full_name, normalise to both)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Backfill staff.name from full_name where null
UPDATE staff SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL;

-- Add department_id to staff if it doesn't exist
ALTER TABLE staff ADD COLUMN IF NOT EXISTS department_id UUID;

-- Add staff_status column
ALTER TABLE staff ADD COLUMN IF NOT EXISTS staff_status VARCHAR(50) DEFAULT 'active';

-- Backfill staff_status from status if null
UPDATE staff SET staff_status = status WHERE staff_status IS NULL AND status IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. ENSURE staff_roles TABLE EXISTS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_roles (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid,
  UNIQUE(staff_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_roles_staff ON staff_roles(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_roles_role  ON staff_roles(role_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. ENSURE users.staff_id COLUMN EXISTS AND IS LINKED
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_users_staff' AND table_name = 'users'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_staff
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_staff_id ON users(staff_id);

-- Auto-link existing users to staff records via matching email
UPDATE users u
SET staff_id = s.id
FROM staff s
WHERE s.email = u.email
  AND u.staff_id IS NULL;

-- Also backfill staff.user_id (reverse direction) from matching email
UPDATE staff s
SET user_id = u.id
FROM users u
WHERE u.email = s.email
  AND s.user_id IS NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. CREATE STAFF RECORDS FOR USERS WITHOUT ONE
--    For any user who still has no staff_id, create a minimal staff record
--    and link them.
-- ────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  rec RECORD;
  new_staff_id uuid;
BEGIN
  FOR rec IN
    SELECT id, email, name, role FROM users WHERE staff_id IS NULL
  LOOP
    -- Insert a staff record derived from the user
    INSERT INTO staff (email, name, staff_status)
    VALUES (
      rec.email,
      COALESCE(rec.name, split_part(rec.email, '@', 1)),
      'active'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO new_staff_id;

    -- If INSERT hit a conflict (e.g. email already exists in staff), find it
    IF new_staff_id IS NULL THEN
      SELECT id INTO new_staff_id FROM staff WHERE email = rec.email LIMIT 1;
    END IF;

    -- Link user to staff record
    IF new_staff_id IS NOT NULL THEN
      UPDATE users SET staff_id = new_staff_id WHERE id = rec.id;
      -- Also set staff.user_id (reverse link)
      UPDATE staff SET user_id = rec.id WHERE id = new_staff_id AND user_id IS NULL;
    END IF;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. MIGRATE user_roles → staff_roles
--    For each (user, role) in user_roles, find the staff record for that user
--    and insert a row in staff_roles.
-- ────────────────────────────────────────────────────────────────────────────

-- Only migrate if user_roles table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles'
  ) THEN
    INSERT INTO staff_roles (staff_id, role_id, assigned_at, assigned_by)
    SELECT
      u.staff_id,
      ur.role_id,
      COALESCE(ur.assigned_at, now()),
      ur.assigned_by
    FROM user_roles ur
    JOIN users u ON ur.user_id = u.id
    WHERE u.staff_id IS NOT NULL
    ON CONFLICT (staff_id, role_id) DO NOTHING;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. ENSURE SUPERADMIN USERS HAVE THE superadmin ROLE IN staff_roles
-- ────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  superadmin_role_id uuid;
BEGIN
  -- Ensure superadmin role exists
  INSERT INTO roles (name, description, is_system, authority_level, hierarchy_level)
  VALUES ('superadmin', 'Full system access', true, 100, 1)
  ON CONFLICT (name) DO NOTHING;

  SELECT id INTO superadmin_role_id FROM roles WHERE name = 'superadmin';

  IF superadmin_role_id IS NOT NULL THEN
    -- For every user with role='superadmin', ensure staff_roles has the link
    INSERT INTO staff_roles (staff_id, role_id)
    SELECT u.staff_id, superadmin_role_id
    FROM users u
    WHERE u.role = 'superadmin'
      AND u.staff_id IS NOT NULL
    ON CONFLICT (staff_id, role_id) DO NOTHING;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. BACKFILL staff.name FROM full_name (for full_name-based schemas)
-- ────────────────────────────────────────────────────────────────────────────

UPDATE staff
SET name = COALESCE(name, full_name, email)
WHERE name IS NULL OR name = '';

-- ────────────────────────────────────────────────────────────────────────────
-- 8. SEED ALL MODULE PERMISSIONS REFERENCED BY NAVIGATION
--    Extends the base seed from migration 934. All ON CONFLICT DO NOTHING.
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO permissions (module, action, description) VALUES
  -- Dashboard
  ('dashboard',           'view',   'View the main dashboard'),
  -- Activity logs
  ('activity_logs',       'view',   'View activity logs'),
  -- Command center
  ('command_center',      'view',   'Access the command center'),
  -- Pipeline
  ('pipeline',            'view',   'View the sales pipeline'),
  ('pipeline',            'manage', 'Manage the sales pipeline'),
  -- Obligations
  ('obligations',         'view',   'View obligations and deliverables'),
  ('obligations',         'manage', 'Manage obligations'),
  -- Allocations
  ('allocations',         'view',   'View money allocations'),
  ('allocations',         'manage', 'Manage money allocations'),
  -- Products
  ('products',            'view',   'View products'),
  ('products',            'manage', 'Manage products'),
  -- Services
  ('services',            'view',   'View services'),
  ('services',            'manage', 'Manage services'),
  -- Media
  ('media',               'view',   'View media files'),
  ('media',               'manage', 'Manage media files'),
  -- Knowledge base
  ('knowledge',           'view',   'View knowledge base'),
  ('knowledge',           'manage', 'Manage knowledge base'),
  -- Accounts (finance sub-module)
  ('accounts',            'view',   'View bank/cash accounts'),
  ('accounts',            'manage', 'Manage bank/cash accounts'),
  -- Expenses
  ('expenses',            'view',   'View expenses'),
  ('expenses',            'manage', 'Manage expenses'),
  -- Budgets
  ('budgets',             'view',   'View budgets'),
  ('budgets',             'manage', 'Manage budgets'),
  -- Intelligence
  ('intelligence',        'view',   'View intelligence dashboard'),
  -- Bug / tech tracking
  ('bug_tracking',        'view',   'View engineering bug tracker'),
  -- Issue intelligence
  ('issue_intelligence',  'view',   'View issue intelligence'),
  -- HRM
  ('hrm',                 'view',   'View HRM dashboard'),
  -- Documents
  ('documents',           'view',   'View documents'),
  ('documents',           'manage', 'Manage documents'),
  -- Decision logs
  ('decision_logs',       'view',   'View decision log'),
  ('decision_logs',       'manage', 'Manage decision log'),
  -- Backups
  ('backups',             'view',   'View system backups'),
  ('backups',             'manage', 'Manage system backups'),
  -- Offerings
  ('offerings',           'view',   'View offerings catalog'),
  ('offerings',           'manage', 'Manage offerings catalog'),
  -- Licenses
  ('licenses',            'view',   'View license registry'),
  ('licenses',            'manage', 'Manage license registry'),
  -- Operations
  ('operations',          'view',   'View operations log'),
  ('operations',          'manage', 'Manage operations log'),
  -- Payments
  ('payments',            'view',   'View payment records'),
  ('payments',            'manage', 'Manage payment records'),
  -- Staff
  ('staff',               'view',   'View staff directory'),
  ('staff',               'create', 'Create staff members'),
  ('staff',               'update', 'Update staff records'),
  ('staff',               'delete', 'Delete staff records')
ON CONFLICT (module, action) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. GRANT SUPERADMIN ROLE ALL PERMISSIONS
--    Ensures superadmin can access every module after the RBAC chain is repaired.
-- ────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  superadmin_role_id uuid;
BEGIN
  SELECT id INTO superadmin_role_id FROM roles WHERE name = 'superadmin';
  IF superadmin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT superadmin_role_id, p.id
    FROM permissions p
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

COMMIT;
