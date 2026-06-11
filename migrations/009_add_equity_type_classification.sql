-- ============================================================================
-- ADD EQUITY TYPE CLASSIFICATION
-- Introduces PURCHASED vs GRANTED distinction without vesting logic
-- Non-breaking change: All existing shares default to PURCHASED
-- ============================================================================

-- 1. Add equity_type column to shareholdings
ALTER TABLE shareholdings
ADD COLUMN equity_type VARCHAR(50) NOT NULL DEFAULT 'PURCHASED';

-- 2. Add constraint for valid equity types
ALTER TABLE shareholdings
ADD CONSTRAINT valid_equity_type CHECK (equity_type IN ('PURCHASED', 'GRANTED'));

-- 3. Update share_issuances to track equity_type issued
ALTER TABLE share_issuances
ADD COLUMN equity_type VARCHAR(50) NOT NULL DEFAULT 'PURCHASED';

ALTER TABLE share_issuances
ADD CONSTRAINT valid_issuance_equity_type CHECK (equity_type IN ('PURCHASED', 'GRANTED'));

-- 4. Update share_transfers to track equity_type transferred
ALTER TABLE share_transfers
ADD COLUMN equity_type VARCHAR(50);

ALTER TABLE share_transfers
ADD CONSTRAINT valid_transfer_equity_type CHECK (equity_type IS NULL OR equity_type IN ('PURCHASED', 'GRANTED'));

-- 5. Create index for equity_type lookups
CREATE INDEX IF NOT EXISTS idx_shareholdings_equity_type ON shareholdings(equity_type);
CREATE INDEX IF NOT EXISTS idx_share_issuances_equity_type ON share_issuances(equity_type);

-- 6. Update existing views to include equity_type

-- Drop existing views first
DROP VIEW IF EXISTS cap_table CASCADE;
DROP VIEW IF EXISTS share_authorization_status CASCADE;
DROP VIEW IF EXISTS shareholder_dilution_history CASCADE;

-- Recreate cap_table with equity_type
CREATE OR REPLACE VIEW cap_table AS
SELECT
  s.id,
  s.shareholder_id,
  s.shareholder_name,
  s.shareholder_email,
  s.shares_owned,
  s.vested_shares,
  (s.shares_owned - s.vested_shares) as unvested_shares,
  s.share_class,
  s.equity_type,
  s.holder_type,
  s.original_ownership_percentage,
  s.current_ownership_percentage,
  s.acquisition_date,
  s.acquisition_price,
  s.investment_total,
  s.status,
  sc.issued_shares,
  (s.shares_owned::DECIMAL / NULLIF(sc.issued_shares, 0) * 100)::DECIMAL(5, 2) as calculated_ownership_pct,
  s.created_at
FROM shareholdings s
CROSS JOIN shares_config sc
WHERE s.status IN ('active', 'vesting')
ORDER BY s.shares_owned DESC;

-- Recreate share_authorization_status
CREATE OR REPLACE VIEW share_authorization_status AS
SELECT
  authorized_shares,
  issued_shares,
  (authorized_shares - issued_shares) as unissued_shares,
  ((authorized_shares - issued_shares)::DECIMAL / authorized_shares * 100)::DECIMAL(5, 2) as pct_authorized_available,
  class_type,
  status,
  created_at,
  updated_at
FROM shares_config;

-- Recreate shareholder_dilution_history with equity_type
CREATE OR REPLACE VIEW shareholder_dilution_history AS
SELECT
  s.shareholder_name,
  s.shareholder_email,
  s.equity_type,
  s.holder_type,
  s.original_ownership_percentage,
  s.current_ownership_percentage,
  (s.original_ownership_percentage - s.current_ownership_percentage)::DECIMAL(5, 2) as total_dilution_pct,
  s.dilution_events_count,
  s.shares_owned,
  s.acquisition_date
FROM shareholdings s
WHERE s.status IN ('active', 'vesting')
  AND s.original_ownership_percentage > s.current_ownership_percentage
ORDER BY total_dilution_pct DESC;

-- 7. Create new view for equity type summary
CREATE OR REPLACE VIEW equity_type_summary AS
SELECT
  equity_type,
  COUNT(*) as shareholder_count,
  SUM(shares_owned) as total_shares,
  SUM(investment_total) as total_investment,
  COUNT(*) FILTER (WHERE equity_type = 'PURCHASED') as purchased_count,
  COUNT(*) FILTER (WHERE equity_type = 'GRANTED') as granted_count
FROM shareholdings
WHERE status IN ('active', 'vesting')
GROUP BY equity_type;

-- 8. Extend audit_logs actions
-- Note: This assumes audit_logs table exists and has valid_action constraint

-- Update audit actions (this is additive, not destructive)
-- We'll handle SHARE_TYPE_UPDATE actions when updating shareholders

-- 9. Add comment for documentation
COMMENT ON COLUMN shareholdings.equity_type IS 
'PURCHASED: Investor equity (paid cash, immediate ownership). GRANTED: Co-founders/staff/advisors (non-cash, future vesting-ready)';

COMMENT ON COLUMN share_issuances.equity_type IS 
'Type of equity being issued: PURCHASED (investor) or GRANTED (founder/employee)';

COMMENT ON COLUMN share_transfers.equity_type IS 
'Type of equity transferred: PURCHASED or GRANTED (if changing classification on transfer)';

-- 10. Verify migration
SELECT 'Equity Type fields added successfully' as status;
SELECT COUNT(*) as shareholdings_with_type FROM shareholdings;
SELECT DISTINCT equity_type FROM shareholdings;
