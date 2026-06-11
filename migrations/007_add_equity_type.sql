-- Migration 007: Add equity_type field to shareholdings and share_issuances tables
-- Supports tracking PURCHASED vs GRANTED equity for cap table tracking

BEGIN;

-- Add equity_type column to shareholdings table
ALTER TABLE shareholdings 
ADD COLUMN IF NOT EXISTS equity_type VARCHAR(50) NOT NULL DEFAULT 'PURCHASED'
CHECK (equity_type IN ('PURCHASED', 'GRANTED'));

-- Add equity_type column to share_issuances table
ALTER TABLE share_issuances 
ADD COLUMN IF NOT EXISTS equity_type VARCHAR(50) NOT NULL DEFAULT 'GRANTED'
CHECK (equity_type IN ('PURCHASED', 'GRANTED'));

-- Add equity_type column to share_transfers table
ALTER TABLE share_transfers 
ADD COLUMN IF NOT EXISTS equity_type VARCHAR(50) NOT NULL DEFAULT 'PURCHASED'
CHECK (equity_type IN ('PURCHASED', 'GRANTED'));

-- Update existing share_transfers records to have equity_type
-- PURCHASED = 'secondary-sale', 'transfer'
-- GRANTED = 'grant'
UPDATE share_transfers
SET equity_type = CASE
  WHEN transfer_type IN ('secondary-sale', 'transfer') THEN 'PURCHASED'
  WHEN transfer_type = 'grant' THEN 'GRANTED'
  ELSE 'PURCHASED'
END
WHERE equity_type IS NULL;

-- Create index on equity_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_shareholdings_equity_type 
ON shareholdings(equity_type);

CREATE INDEX IF NOT EXISTS idx_share_issuances_equity_type 
ON share_issuances(equity_type);

CREATE INDEX IF NOT EXISTS idx_share_transfers_equity_type 
ON share_transfers(equity_type);

COMMIT;
