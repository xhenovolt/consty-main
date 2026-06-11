-- Migration: Update deals table schema
-- 
-- Converts the deals table from using client_name/notes to using
-- description/assigned_to for better data modeling and staff assignment

-- ============================================================================
-- ALTER DEALS TABLE SCHEMA
-- ============================================================================

-- Add new columns if they don't exist
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE deals
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for assigned_to queries
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to);
