-- Migration: Set share par value to 920K UGX
-- Purpose: Configure shares to be worth 920K UGX each with max 1M shares
-- Impact: Updates existing shares configuration to new valuation model

-- Update shares table to set par_value to 920K UGX
UPDATE shares 
SET par_value = 920000.00
WHERE class_type = 'common' OR class_type IS NULL;

-- Ensure default shares exist with correct configuration
INSERT INTO shares (total_shares, par_value, class_type, status)
VALUES (1000000, 920000.00, 'common', 'active')
ON CONFLICT DO NOTHING;

-- Add comment to explain the configuration
COMMENT ON COLUMN shares.par_value IS 'Par value per share in UGX. Standard value: 920,000 UGX per share.';
COMMENT ON COLUMN shares.total_shares IS 'Total authorized shares. Maximum: 1,000,000 shares (1M).';
