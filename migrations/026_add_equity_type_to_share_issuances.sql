-- Add missing equity_type column to share_issuances table
ALTER TABLE share_issuances
ADD COLUMN IF NOT EXISTS equity_type VARCHAR(50) DEFAULT 'PURCHASED';

-- Add constraint to ensure valid values
ALTER TABLE share_issuances
ADD CONSTRAINT IF NOT EXISTS valid_issuance_equity_type_check 
CHECK (equity_type IN ('PURCHASED', 'GRANTED'));
