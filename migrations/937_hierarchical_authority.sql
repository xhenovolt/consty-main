-- ============================================================================
-- Migration 937: Hierarchical Authority Enforcement
-- Date: 2026-03-16
-- Purpose:
--   1. Ensure roles.authority_level is populated with canonical values
--   2. Extend activity_logs to record actor role + authority level
--   3. Add users.authority_level (denormalised fast-path for session loading)
--   4. Add users.first_login_completed flag
--   5. Add staff.linked_user_id for explicit staff→user linkage
--   6. Index all new columns for query performance
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. ENSURE roles.authority_level EXISTS AND IS PROPERLY POPULATED
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE roles ADD COLUMN IF NOT EXISTS authority_level integer NOT NULL DEFAULT 10;

-- Canonical authority levels (higher = more authority)
UPDATE roles SET authority_level = 100 WHERE name ILIKE 'superadmin'  AND (authority_level IS NULL OR authority_level = 0 OR authority_level = 10);
UPDATE roles SET authority_level = 80  WHERE name ILIKE 'admin'       AND (authority_level IS NULL OR authority_level = 0 OR authority_level = 10);
UPDATE roles SET authority_level = 60  WHERE name ILIKE 'manager'     AND (authority_level IS NULL OR authority_level = 0 OR authority_level = 10);
UPDATE roles SET authority_level = 50  WHERE name ILIKE 'supervisor'  AND (authority_level IS NULL OR authority_level = 0 OR authority_level = 10);
UPDATE roles SET authority_level = 40  WHERE (name ILIKE 'user' OR name ILIKE 'staff') AND (authority_level IS NULL OR authority_level = 0 OR authority_level = 10);
UPDATE roles SET authority_level = 30  WHERE name ILIKE 'viewer'      AND (authority_level IS NULL OR authority_level = 0 OR authority_level = 10);
UPDATE roles SET authority_level = 30  WHERE name ILIKE 'sales'       AND (authority_level IS NULL OR authority_level = 0 OR authority_level = 10);
UPDATE roles SET authority_level = 10  WHERE name ILIKE 'squire'      AND (authority_level IS NULL OR authority_level = 0 OR authority_level = 10);

CREATE INDEX IF NOT EXISTS idx_roles_authority_level ON roles(authority_level);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. EXTEND activity_logs WITH ACTOR AUTHORITY TRACKING
-- ────────────────────────────────────────────────────────────────────────────

-- Add actor role tracking columns
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS actor_role_id    uuid REFERENCES roles(id) ON DELETE SET NULL;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS actor_authority_level integer NOT NULL DEFAULT 0;

-- Backfill actor_authority_level for existing rows via staff_roles chain
UPDATE activity_logs al
SET
  actor_role_id = (
    SELECT sr.role_id
    FROM users u
    JOIN staff s ON u.staff_id = s.id
    JOIN staff_roles sr ON sr.staff_id = s.id
    JOIN roles r ON sr.role_id = r.id
    WHERE u.id = al.user_id
    ORDER BY r.authority_level DESC
    LIMIT 1
  ),
  actor_authority_level = (
    SELECT COALESCE(MAX(r.authority_level), 0)
    FROM users u
    JOIN staff s ON u.staff_id = s.id
    JOIN staff_roles sr ON sr.staff_id = s.id
    JOIN roles r ON sr.role_id = r.id
    WHERE u.id = al.user_id
  )
WHERE actor_authority_level = 0;

-- Handle superadmin users who may not have a staff record
UPDATE activity_logs al
SET actor_authority_level = 100
FROM users u
WHERE al.user_id = u.id
  AND u.role = 'superadmin'
  AND al.actor_authority_level = 0;

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_authority ON activity_logs(actor_authority_level);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_role ON activity_logs(actor_role_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. USERS TABLE — DENORMALISED AUTHORITY LEVEL + FIRST LOGIN FLAG
-- ────────────────────────────────────────────────────────────────────────────

-- Fast-path authority level (avoids role join on every request)
ALTER TABLE users ADD COLUMN IF NOT EXISTS authority_level integer NOT NULL DEFAULT 10;

-- First-login tracking (separate from must_reset_password)
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_login_completed boolean NOT NULL DEFAULT true;

-- Backfill authority_level from the highest role assigned via staff_roles
UPDATE users u
SET authority_level = (
  SELECT COALESCE(MAX(r.authority_level), 10)
  FROM staff s
  JOIN staff_roles sr ON sr.staff_id = s.id
  JOIN roles r ON sr.role_id = r.id
  WHERE s.id = u.staff_id
)
WHERE u.staff_id IS NOT NULL;

-- Superadmins always get 100
UPDATE users SET authority_level = 100 WHERE role = 'superadmin';

CREATE INDEX IF NOT EXISTS idx_users_authority_level ON users(authority_level);
CREATE INDEX IF NOT EXISTS idx_users_first_login ON users(first_login_completed);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. STAFF TABLE — EXPLICIT LINKED USER REFERENCE
-- ────────────────────────────────────────────────────────────────────────────

-- linked_user_id is the canonical reference: staff → user account
ALTER TABLE staff ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- Backfill from users.staff_id (users already know their staff record)
UPDATE staff s
SET linked_user_id = u.id
FROM users u
WHERE u.staff_id = s.id
  AND s.linked_user_id IS NULL;

-- Also try the legacy user_id column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff' AND column_name = 'user_id'
  ) THEN
    UPDATE staff s
    SET linked_user_id = user_id
    WHERE user_id IS NOT NULL AND linked_user_id IS NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_linked_user ON staff(linked_user_id) WHERE linked_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_linked_user_id ON staff(linked_user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. HELPER FUNCTION: resolve_actor_authority(user_id)
--    Returns the highest authority_level for a given user via staff_roles.
--    Used internally and by the activity logging pipeline.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION resolve_actor_authority(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_authority integer;
  v_role text;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = p_user_id;
  IF v_role = 'superadmin' THEN RETURN 100; END IF;

  SELECT COALESCE(MAX(r.authority_level), 10)
  INTO v_authority
  FROM users u
  JOIN staff s ON u.staff_id = s.id
  JOIN staff_roles sr ON sr.staff_id = s.id
  JOIN roles r ON sr.role_id = r.id
  WHERE u.id = p_user_id;

  RETURN COALESCE(v_authority, 10);
END;
$$;

COMMIT;
