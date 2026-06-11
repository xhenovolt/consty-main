-- ============================================================================
-- ADD NAME COLUMN TO USERS TABLE
-- Ensure users table has proper name fields for shareholder management
-- ============================================================================

-- Add full_name column if it doesn't exist
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);

-- Add index for searching by email
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email) WHERE status = 'active';

-- Update existing users with placeholder names if needed
UPDATE users SET full_name = email WHERE full_name IS NULL OR full_name = '';
