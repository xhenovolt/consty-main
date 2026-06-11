-- Migration 932: Users Module Repair — Presence + RBAC Integration
-- Adds 'away' status to presence, device_info, account_status for staff,
-- and ensures staff can be linked to auth users for presence tracking.

-- ============================================================================
-- 1. EXPAND user_presence STATUS CHECK to include 'away'
-- ============================================================================

ALTER TABLE user_presence DROP CONSTRAINT IF EXISTS user_presence_status_check;
ALTER TABLE user_presence ADD CONSTRAINT user_presence_status_check
  CHECK (status IN ('online', 'away', 'offline'));

-- Add device_info column
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS device_info TEXT;

-- ============================================================================
-- 2. ADD account_status TO staff TABLE
-- ============================================================================

ALTER TABLE staff ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active';

-- Cannot use IF NOT EXISTS with ADD CONSTRAINT in PostgreSQL, so use DO block
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'staff_account_status_check' AND table_name = 'staff'
  ) THEN
    ALTER TABLE staff ADD CONSTRAINT staff_account_status_check
      CHECK (account_status IN ('active', 'suspended', 'terminated'));
  END IF;
END $$;

-- Backfill: set account_status based on existing status
UPDATE staff SET account_status = 'active' WHERE account_status IS NULL;

-- ============================================================================
-- 3. ENSURE role_id COLUMN EXISTS ON staff
-- ============================================================================

ALTER TABLE staff ADD COLUMN IF NOT EXISTS role_id UUID;

-- ============================================================================
-- 4. ADD user_id TO staff FOR PRESENCE LINKING
-- ============================================================================

ALTER TABLE staff ADD COLUMN IF NOT EXISTS user_id UUID;

-- Try to auto-link staff to users via email
UPDATE staff s
SET user_id = u.id
FROM users u
WHERE s.email IS NOT NULL
  AND s.email = u.email
  AND s.user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_account_status ON staff(account_status);
