-- ============================================================================
-- CREATE COMPLETE SHAREHOLDINGS TABLE WITH ALL REQUIRED COLUMNS
-- This is a simplified, consolidated migration for the shareholdings table
-- ============================================================================

-- Create shares_config table first
CREATE TABLE IF NOT EXISTS shares_config (
  id SERIAL PRIMARY KEY,
  authorized_shares BIGINT NOT NULL DEFAULT 10000000,
  issued_shares BIGINT NOT NULL DEFAULT 1000000,
  par_value DECIMAL(19, 4) NOT NULL DEFAULT 1.0000,
  class_type VARCHAR(50) NOT NULL DEFAULT 'Common',
  company_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT authorized_gte_issued CHECK (authorized_shares >= issued_shares),
  CONSTRAINT positive_authorized CHECK (authorized_shares > 0),
  CONSTRAINT positive_issued CHECK (issued_shares > 0),
  CONSTRAINT positive_par CHECK (par_value > 0)
);

-- Create shareholdings table WITH equity_type column included from the start
CREATE TABLE IF NOT EXISTS shareholdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Shareholder Identity
  shareholder_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  shareholder_name VARCHAR(255) NOT NULL,
  shareholder_email VARCHAR(255),
  
  -- Share Information
  shares_owned BIGINT NOT NULL DEFAULT 0,
  share_class VARCHAR(50) NOT NULL DEFAULT 'Common',
  
  -- Equity Type (PURCHASED vs GRANTED)
  equity_type VARCHAR(50) NOT NULL DEFAULT 'PURCHASED',
  
  -- Vesting Information
  vesting_start_date DATE,
  vesting_end_date DATE,
  vesting_schedule VARCHAR(50),
  vesting_cliff_percentage DECIMAL(5, 2) DEFAULT 0,
  vested_shares BIGINT DEFAULT 0,
  
  -- Investment Information
  acquisition_date DATE NOT NULL DEFAULT CURRENT_DATE,
  acquisition_price DECIMAL(19, 4),
  investment_total DECIMAL(19, 2),
  
  -- Dilution Tracking
  original_ownership_percentage DECIMAL(5, 2),
  current_ownership_percentage DECIMAL(5, 2),
  dilution_events_count INT DEFAULT 0,
  
  -- Status and Metadata
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  holder_type VARCHAR(50),
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT positive_shares CHECK (shares_owned >= 0),
  CONSTRAINT positive_vested CHECK (vested_shares >= 0),
  CONSTRAINT vested_lte_owned CHECK (vested_shares <= shares_owned),
  CONSTRAINT valid_percentage CHECK (
    original_ownership_percentage >= 0 AND original_ownership_percentage <= 100 AND
    current_ownership_percentage >= 0 AND current_ownership_percentage <= 100
  ),
  CONSTRAINT valid_equity_type CHECK (equity_type IN ('PURCHASED', 'GRANTED'))
);

-- Create indexes for shareholdings
CREATE INDEX IF NOT EXISTS idx_shareholdings_shareholder_id ON shareholdings(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_shareholdings_status ON shareholdings(status);
CREATE INDEX IF NOT EXISTS idx_shareholdings_equity_type ON shareholdings(equity_type);

-- Create share_transfers table
CREATE TABLE IF NOT EXISTS share_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_shareholder_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  to_shareholder_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  shares_transferred BIGINT NOT NULL,
  transfer_price_per_share DECIMAL(19, 4),
  transfer_total DECIMAL(19, 2),
  transfer_type VARCHAR(50) NOT NULL,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transfer_status VARCHAR(50) NOT NULL DEFAULT 'completed',
  equity_type VARCHAR(50),
  shares_returned BIGINT DEFAULT 0,
  reason VARCHAR(500),
  notes TEXT,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT positive_transferred CHECK (shares_transferred > 0),
  CONSTRAINT different_parties CHECK (from_shareholder_id != to_shareholder_id),
  CONSTRAINT valid_price CHECK (transfer_price_per_share IS NULL OR transfer_price_per_share > 0),
  CONSTRAINT valid_transfer_equity_type CHECK (equity_type IS NULL OR equity_type IN ('PURCHASED', 'GRANTED'))
);

-- Create share_issuances table
CREATE TABLE IF NOT EXISTS share_issuances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shares_issued BIGINT NOT NULL,
  issued_at_price DECIMAL(19, 4),
  valuation_post_issuance DECIMAL(19, 2),
  recipient_id UUID,
  recipient_type VARCHAR(50),
  issuance_reason VARCHAR(500),
  issuance_type VARCHAR(50) NOT NULL DEFAULT 'equity',
  equity_type VARCHAR(50) NOT NULL DEFAULT 'PURCHASED',
  approval_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  requires_confirmation BOOLEAN DEFAULT TRUE,
  confirmation_received BOOLEAN DEFAULT FALSE,
  previous_issued_shares BIGINT,
  ownership_dilution_impact DECIMAL(5, 2),
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  issued_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  CONSTRAINT positive_issued CHECK (shares_issued > 0),
  CONSTRAINT positive_price CHECK (issued_at_price IS NULL OR issued_at_price > 0),
  CONSTRAINT valid_issuance_equity_type CHECK (equity_type IN ('PURCHASED', 'GRANTED'))
);

-- Insert default shares_config if not exists
INSERT INTO shares_config (authorized_shares, issued_shares, par_value, class_type, status)
VALUES (10000000, 1000000, 1.0000, 'Common', 'active')
ON CONFLICT DO NOTHING;
