-- ============================================================================
-- Migration 934: Staff-User Identity Link & RBAC Hardening
-- Date: 2026-03-15
-- Purpose:
--   1. Link users to staff records (users.staff_id → staff.id)
--   2. Add must_reset_password flag for first-login forced reset
--   3. Ensure users.username column exists (first-login account setup)
--   4. Add PATCH support for individual permission toggles via a toggle table view
-- Safety: All operations use IF NOT EXISTS / DO $$ guards
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. ADD staff_id TO users TABLE
--    Direction: users → staff (every user must belong to exactly one staff member)
--    Nullable for the initial superadmin bootstrap who has no staff record
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
WHERE u.email = s.email
  AND u.staff_id IS NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. ADD must_reset_password FLAG TO users TABLE
--    Set to true when a superadmin creates a user with a temporary password.
--    Cleared after the user completes the first-login password setup.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT false;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. ENSURE username COLUMN EXISTS ON users
--    username format: lowercase, letters/numbers/underscores only
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);

-- Back-fill username from email prefix for existing users who are missing it
UPDATE users
SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-z0-9_]', '_', 'g'))
WHERE username IS NULL OR username = '';

-- Add unique constraint on username (using a DO block to avoid duplicate constraint errors)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'users_username_key'
  ) THEN
    CREATE UNIQUE INDEX users_username_key ON users(username) WHERE username IS NOT NULL;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. ADD status COLUMN TO users (if not already present)
--    Values: active, pending, suspended, disabled
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_status_check' AND table_name = 'users'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_status_check
      CHECK (status IN ('active', 'pending', 'suspended', 'disabled'));
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. SEED CORE PERMISSIONS (module.action format)
--    Idempotent: ON CONFLICT DO NOTHING
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO permissions (module, action, description) VALUES
  -- Dashboard
  ('dashboard',   'view',   'View the main dashboard'),
  -- Users
  ('users',       'view',   'View user list'),
  ('users',       'create', 'Create new user accounts'),
  ('users',       'update', 'Update user accounts'),
  ('users',       'delete', 'Delete user accounts'),
  -- Staff
  ('staff',       'view',   'View staff directory'),
  ('staff',       'create', 'Create staff members'),
  ('staff',       'update', 'Update staff records'),
  ('staff',       'delete', 'Delete staff records'),
  -- Roles
  ('roles',       'manage', 'Full control over roles and permissions'),
  -- Finance
  ('finance',     'view',   'View financial records'),
  ('finance',     'create', 'Create financial transactions'),
  ('finance',     'manage', 'Full finance management'),
  -- Deals
  ('deals',       'view',   'View deals'),
  ('deals',       'create', 'Create deals'),
  ('deals',       'update', 'Update deals'),
  ('deals',       'delete', 'Delete deals'),
  -- Clients
  ('clients',     'view',   'View client records'),
  ('clients',     'create', 'Create client records'),
  ('clients',     'update', 'Update client records'),
  ('clients',     'delete', 'Delete client records'),
  -- Prospects
  ('prospects',   'view',   'View prospect records'),
  ('prospects',   'create', 'Create prospect records'),
  ('prospects',   'update', 'Update prospect records'),
  ('prospects',   'delete', 'Delete prospect records'),
  -- Reports
  ('reports',     'view',   'View reports'),
  ('reports',     'export', 'Export reports'),
  -- Settings
  ('settings',    'view',   'View system settings'),
  ('settings',    'manage', 'Manage system settings'),
  -- Audit
  ('audit',       'view',   'View audit logs'),
  -- Departments
  ('departments', 'view',   'View departments'),
  ('departments', 'manage', 'Manage departments'),
  -- Assets
  ('assets',      'view',   'View assets'),
  ('assets',      'manage', 'Manage assets'),
  -- Systems
  ('systems',     'view',   'View systems'),
  ('systems',     'manage', 'Manage systems'),
  -- Invoices
  ('invoices',    'view',   'View invoices'),
  ('invoices',    'create', 'Create invoices'),
  ('invoices',    'manage', 'Full invoice management'),
  -- Approvals
  ('approvals',   'view',   'View approval requests'),
  ('approvals',   'manage', 'Manage approval requests')
ON CONFLICT (module, action) DO NOTHING;

COMMIT;
