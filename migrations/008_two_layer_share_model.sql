-- Migration 008: Two-Layer Share Model with Authorized/Issued Shares, Valuation Engine, and Vesting
-- Implements URSB-style corporate registry with proper distinction between authorized and issued shares

BEGIN;

-- ============================================================================
-- 1. SHARES CONFIGURATION - Authorized Shares Model
-- ============================================================================

CREATE TABLE IF NOT EXISTS shares_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorized_shares BIGINT NOT NULL CHECK (authorized_shares > 0),
  issued_shares BIGINT NOT NULL DEFAULT 0 CHECK (issued_shares >= 0 AND issued_shares <= authorized_shares),
  par_value DECIMAL(18, 2),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT issued_not_exceed_authorized CHECK (issued_shares <= authorized_shares)
);

-- Only one config record should exist
-- Handle both cases: when shares table exists and when it doesn't
INSERT INTO shares_config (authorized_shares, par_value, description)
  SELECT COALESCE(MAX(total_shares), 1000000), 1.00, 'Default company shares configuration'
  FROM (
    SELECT total_shares FROM shares LIMIT 1
    UNION ALL
    SELECT 1000000 WHERE NOT EXISTS (SELECT 1 FROM shares)
  ) t
  ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. VALUATION SNAPSHOTS - Store historical valuation records
-- ============================================================================

CREATE TABLE IF NOT EXISTS valuation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shares_config_id UUID NOT NULL REFERENCES shares_config(id) ON DELETE CASCADE,
  
  -- Pre-money and post-money valuations
  pre_money_valuation DECIMAL(18, 2),
  investment_amount DECIMAL(18, 2),
  post_money_valuation DECIMAL(18, 2),
  
  -- Calculated share price
  share_price DECIMAL(18, 2),
  
  -- Issued shares count after this valuation round
  issued_shares_after BIGINT,
  
  -- Round information
  round_name VARCHAR(100), -- e.g., "Seed", "Series A", "Series B"
  investor_name VARCHAR(255),
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by_id UUID,
  
  CONSTRAINT valid_valuation CHECK (
    (pre_money_valuation IS NULL AND post_money_valuation IS NULL AND investment_amount IS NULL)
    OR (pre_money_valuation IS NOT NULL AND investment_amount IS NOT NULL)
  )
);

CREATE INDEX idx_valuation_snapshots_config_id ON valuation_snapshots(shares_config_id);
CREATE INDEX idx_valuation_snapshots_created_at ON valuation_snapshots(created_at DESC);

-- ============================================================================
-- 3. ENHANCED SHAREHOLDINGS - Add vesting and valuation tracking
-- ============================================================================

ALTER TABLE shareholdings 
ADD COLUMN IF NOT EXISTS vesting_start_date DATE,
ADD COLUMN IF NOT EXISTS vesting_end_date DATE,
ADD COLUMN IF NOT EXISTS vesting_percentage DECIMAL(5, 2) DEFAULT 100 CHECK (vesting_percentage >= 0 AND vesting_percentage <= 100),
ADD COLUMN IF NOT EXISTS valuation_snapshot_id UUID REFERENCES valuation_snapshots(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(18, 2);

CREATE INDEX IF NOT EXISTS idx_shareholdings_vesting_end ON shareholdings(vesting_end_date);
CREATE INDEX IF NOT EXISTS idx_shareholdings_equity_type_vesting ON shareholdings(equity_type, vesting_end_date);

-- ============================================================================
-- 4. VESTING CALCULATION HELPER VIEW
-- ============================================================================

CREATE OR REPLACE VIEW shareholdings_with_vesting AS
SELECT 
  sh.id,
  sh.shareholder_id,
  sh.shareholder_name,
  sh.shares_owned,
  sh.equity_type,
  sh.vesting_start_date,
  sh.vesting_end_date,
  sh.vesting_percentage,
  
  -- Calculate vested shares for GRANTED equity only
  CASE 
    WHEN sh.equity_type = 'PURCHASED' THEN sh.shares_owned
    WHEN sh.equity_type = 'GRANTED' AND sh.vesting_start_date IS NULL THEN 0
    WHEN sh.equity_type = 'GRANTED' AND CURRENT_DATE < sh.vesting_start_date THEN 0
    WHEN sh.equity_type = 'GRANTED' AND CURRENT_DATE >= sh.vesting_end_date THEN 
      sh.shares_owned * (sh.vesting_percentage / 100.0)
    WHEN sh.equity_type = 'GRANTED' THEN
      FLOOR(
        sh.shares_owned * 
        GREATEST(0, LEAST(1.0, 
          (EXTRACT(DAY FROM (CURRENT_DATE - sh.vesting_start_date))::FLOAT / 
           NULLIF(EXTRACT(DAY FROM (sh.vesting_end_date - sh.vesting_start_date)), 0))
        )) * 
        (sh.vesting_percentage / 100.0)
      )
    ELSE 0
  END AS vested_shares,
  
  -- Calculate unvested shares
  CASE
    WHEN sh.equity_type = 'PURCHASED' THEN 0
    WHEN sh.equity_type = 'GRANTED' THEN
      sh.shares_owned - CASE 
        WHEN sh.vesting_start_date IS NULL THEN 0
        WHEN CURRENT_DATE < sh.vesting_start_date THEN 0
        WHEN CURRENT_DATE >= sh.vesting_end_date THEN 
          sh.shares_owned * (sh.vesting_percentage / 100.0)
        ELSE
          FLOOR(
            sh.shares_owned * 
            GREATEST(0, LEAST(1.0, 
              (EXTRACT(DAY FROM (CURRENT_DATE - sh.vesting_start_date))::FLOAT / 
               NULLIF(EXTRACT(DAY FROM (sh.vesting_end_date - sh.vesting_start_date)), 0))
            )) * 
            (sh.vesting_percentage / 100.0)
          )
      END
    ELSE sh.shares_owned
  END AS unvested_shares,
  
  sh.holder_type,
  sh.acquisition_date,
  sh.acquisition_price,
  sh.investment_total,
  sh.status,
  sh.created_at,
  sh.updated_at
FROM shareholdings sh;

-- ============================================================================
-- 5. SHARE TRANSACTIONS LOG - Track all share movements
-- ============================================================================

CREATE TABLE IF NOT EXISTS share_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type VARCHAR(50) NOT NULL, -- 'issuance', 'transfer', 'buyback', 'vesting', 'forfeiture'
  
  from_shareholder_id UUID REFERENCES users(id),
  to_shareholder_id UUID REFERENCES users(id),
  
  shares_amount BIGINT NOT NULL CHECK (shares_amount > 0),
  price_per_share DECIMAL(18, 2),
  total_value DECIMAL(18, 2),
  
  equity_type VARCHAR(50), -- 'PURCHASED' or 'GRANTED'
  
  reason TEXT,
  reference_id UUID, -- Link to issuance, transfer, or buyback record
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by_id UUID,
  
  CONSTRAINT valid_transfer CHECK (
    (transaction_type = 'issuance' AND from_shareholder_id IS NULL AND to_shareholder_id IS NOT NULL)
    OR (transaction_type != 'issuance' AND from_shareholder_id IS NOT NULL AND to_shareholder_id IS NOT NULL)
  )
);

CREATE INDEX idx_share_transactions_type ON share_transactions(transaction_type);
CREATE INDEX idx_share_transactions_from ON share_transactions(from_shareholder_id);
CREATE INDEX idx_share_transactions_to ON share_transactions(to_shareholder_id);
CREATE INDEX idx_share_transactions_created_at ON share_transactions(created_at DESC);

-- ============================================================================
-- 6. BUYBACK RECORDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS share_buybacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id UUID NOT NULL REFERENCES users(id),
  shares_repurchased BIGINT NOT NULL CHECK (shares_repurchased > 0),
  buyback_price_per_share DECIMAL(18, 2),
  total_repurchase_value DECIMAL(18, 2),
  buyback_date DATE DEFAULT CURRENT_DATE,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'approved', 'completed', 'cancelled')),
  approved_by_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_share_buybacks_shareholder ON share_buybacks(shareholder_id);
CREATE INDEX idx_share_buybacks_date ON share_buybacks(buyback_date DESC);
CREATE INDEX idx_share_buybacks_status ON share_buybacks(status);

-- ============================================================================
-- 7. SHAREHOLDER EXITS
-- ============================================================================

CREATE TABLE IF NOT EXISTS shareholder_exits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id UUID NOT NULL REFERENCES users(id),
  exit_type VARCHAR(50) NOT NULL, -- 'departure', 'full_liquidation', 'partial_liquidation'
  
  shares_retained BIGINT DEFAULT 0,
  shares_sold_back BIGINT DEFAULT 0,
  shares_forfeited BIGINT DEFAULT 0,
  
  exit_price_per_share DECIMAL(18, 2),
  total_exit_value DECIMAL(18, 2),
  
  exit_date DATE DEFAULT CURRENT_DATE,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'completed',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by_id UUID
);

CREATE INDEX idx_shareholder_exits_shareholder ON shareholder_exits(shareholder_id);
CREATE INDEX idx_shareholder_exits_date ON shareholder_exits(exit_date DESC);

-- ============================================================================
-- 8. UPDATE EXISTING SHARES CONFIG IF NEEDED
-- ============================================================================

UPDATE shares_config
SET updated_at = CURRENT_TIMESTAMP
WHERE authorized_shares > 0;

COMMIT;
