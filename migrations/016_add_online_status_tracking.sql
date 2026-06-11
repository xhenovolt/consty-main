-- ============================================================================
-- ADD ONLINE STATUS TRACKING
-- Adds last_seen and is_online columns for user activity monitoring
-- ============================================================================

-- Add columns to users table if they don't exist
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Create index for efficient is_online queries
CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);

-- Create function to update is_online based on last_seen activity
CREATE OR REPLACE FUNCTION update_user_online_status()
RETURNS TRIGGER AS $$
BEGIN
  -- User is considered online if last_seen is within last 15 minutes
  NEW.is_online = (NEW.last_seen IS NOT NULL AND NEW.last_seen > NOW() - INTERVAL '15 minutes');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update is_online when last_seen changes
DROP TRIGGER IF EXISTS user_online_status_trigger ON users;
CREATE TRIGGER user_online_status_trigger
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_user_online_status();

-- Update existing users to set initial online status
UPDATE users SET is_online = false WHERE is_online IS NULL;
