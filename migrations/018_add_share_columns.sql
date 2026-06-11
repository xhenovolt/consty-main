/**
 * Migration 018: Add share management columns to shares table
 * 
 * The shares table currently only has total_shares, but the application
 * requires more granular tracking:
 * - authorized_shares: Maximum shares that can be issued
 * - issued_shares: Shares that have been officially issued
 * - allocated_shares: Shares currently allocated to shareholders
 */

-- Add missing columns to shares table if they don't exist
ALTER TABLE shares
ADD COLUMN IF NOT EXISTS authorized_shares BIGINT NOT NULL DEFAULT 1000000,
ADD COLUMN IF NOT EXISTS issued_shares BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS allocated_shares BIGINT NOT NULL DEFAULT 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shares_authorized ON shares(authorized_shares);
CREATE INDEX IF NOT EXISTS idx_shares_issued ON shares(issued_shares);
CREATE INDEX IF NOT EXISTS idx_shares_allocated ON shares(allocated_shares);

-- Add comment to document the columns
COMMENT ON COLUMN shares.authorized_shares IS 'Maximum number of shares that can be issued (controls scarcity)';
COMMENT ON COLUMN shares.issued_shares IS 'Number of shares officially issued by the company';
COMMENT ON COLUMN shares.allocated_shares IS 'Number of shares currently allocated to shareholders';
