-- Migration: Update shares model to authorized shares with company valuation
-- Purpose: Upgrade from fixed 1M shares to flexible authorized shares system
-- This allows companies to control scarcity and calculate share price dynamically

-- Add new columns if they don't exist
ALTER TABLE shares ADD COLUMN IF NOT EXISTS authorized_shares BIGINT DEFAULT 100;
ALTER TABLE shares ADD COLUMN IF NOT EXISTS company_valuation DECIMAL(19, 2) DEFAULT 0.00;

-- Migrate existing data
-- If old par_value existed, use it to back-calculate (assume old system had 1M shares at par_value each)
-- If migrating from old system: authorized_shares = 100 (new default)
-- company_valuation will be set via settings
UPDATE shares 
SET 
  authorized_shares = COALESCE(authorized_shares, 100),
  company_valuation = COALESCE(company_valuation, 0.00)
WHERE authorized_shares IS NULL OR company_valuation IS NULL;

-- Drop old par_value column if it exists (no longer used)
ALTER TABLE shares DROP COLUMN IF EXISTS par_value CASCADE;

-- Drop old total_shares column if it exists
ALTER TABLE shares DROP COLUMN IF EXISTS total_shares CASCADE;

-- Add comment to explain new model
COMMENT ON COLUMN shares.authorized_shares IS 'Maximum number of shares that can ever be issued. Controls equity scarcity and share value.';
COMMENT ON COLUMN shares.company_valuation IS 'Total company valuation in UGX. Used to calculate price per share: price = valuation / authorized_shares';

-- Ensure only one row (singleton pattern)
DELETE FROM shares WHERE id > 1;
ALTER TABLE shares ADD CONSTRAINT only_one_row CHECK (id = 1);
