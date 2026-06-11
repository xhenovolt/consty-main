-- ============================================================================
-- CORPORATE EQUITY SYSTEM REFACTOR
-- Implements URSB-compliant share structure with:
-- - Authorized Shares (maximum allowable)
-- - Issued Shares (officially created)
-- - Allocated Shares (owned by shareholders)
-- - Share Transfers (ownership changes without dilution)
-- - Share Issuance (new share creation with dilution)
-- ============================================================================

-- ============================================================================
-- PHASE 1: BACKUP EXISTING DATA (OPTIONAL)
-- ============================================================================
-- Existing data in shares and share_allocations will be preserved and migrated

-- ============================================================================
-- PHASE 2: CREATE NEW SHARES TABLE (AUTHORIZED/ISSUED/ALLOCATED)
-- ============================================================================

CREATE TABLE IF NOT EXISTS shares_config (
  id SERIAL PRIMARY KEY,
  authorized_shares BIGINT NOT NULL DEFAULT 10000000,
  -- Authorized shares = maximum shares company can ever issue
  
  issued_shares BIGINT NOT NULL DEFAULT 1000000,
  -- Issued shares = shares actually created (can never exceed authorized)
  
  par_value DECIMAL(19, 4) NOT NULL DEFAULT 1.0000,
  -- Par value = stated value per share (tax and legal purposes)
  
  class_type VARCHAR(50) NOT NULL DEFAULT 'Common',
  -- Share class: Common, Preferred, Restricted, etc.
  
  company_id UUID,
  -- Link to company/organization (future multi-tenant support)
  
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  -- Status: active, suspended, dissolved
  
  notes TEXT,
  -- Audit trail: reason for configuration changes
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT authorized_gte_issued CHECK (authorized_shares >= issued_shares),
  CONSTRAINT positive_authorized CHECK (authorized_shares > 0),
  CONSTRAINT positive_issued CHECK (issued_shares > 0),
  CONSTRAINT positive_par CHECK (par_value > 0)
);

-- ============================================================================
-- PHASE 3: CREATE SHAREHOLDINGS TABLE (REPLACES share_allocations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS shareholdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Shareholder Identity
  shareholder_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  shareholder_name VARCHAR(255) NOT NULL,
  shareholder_email VARCHAR(255),
  
  -- Share Information
  shares_owned BIGINT NOT NULL DEFAULT 0,
  -- Current number of shares owned by this shareholder
  
  share_class VARCHAR(50) NOT NULL DEFAULT 'Common',
  -- Share class (allows for preferred, restricted, etc.)
  
  -- Vesting Information (for employee shares, options, etc.)
  vesting_start_date DATE,
  vesting_end_date DATE,
  vesting_schedule VARCHAR(50),
  -- Schedule: 'cliff-4yr-1yr', 'linear-4yr', 'monthly', 'custom'
  vesting_cliff_percentage DECIMAL(5, 2) DEFAULT 0,
  -- % vested at cliff date
  vested_shares BIGINT DEFAULT 0,
  -- Shares already vested (cannot be forfeited)
  
  -- Investment Information
  acquisition_date DATE NOT NULL DEFAULT CURRENT_DATE,
  acquisition_price DECIMAL(19, 4),
  -- Price per share paid at acquisition
  
  investment_total DECIMAL(19, 2),
  -- Total $ invested (shares_owned * acquisition_price)
  
  -- Dilution Tracking
  original_ownership_percentage DECIMAL(5, 2),
  -- Original % when shares were first acquired
  
  current_ownership_percentage DECIMAL(5, 2),
  -- Current % after all dilutions
  
  dilution_events_count INT DEFAULT 0,
  -- Number of new issuances this shareholder experienced
  
  -- Status and Metadata
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  -- Status: active, vesting, forfeited, restricted, transferred
  
  holder_type VARCHAR(50),
  -- Type: founder, employee, investor, advisor, employee-option, etc.
  
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT positive_shares CHECK (shares_owned >= 0),
  CONSTRAINT positive_vested CHECK (vested_shares >= 0),
  CONSTRAINT vested_lte_owned CHECK (vested_shares <= shares_owned),
  CONSTRAINT valid_percentage CHECK (
    original_ownership_percentage >= 0 AND original_ownership_percentage <= 100 AND
    current_ownership_percentage >= 0 AND current_ownership_percentage <= 100
  )
);

-- ============================================================================
-- PHASE 4: SHARE TRANSFER TABLE (TRACK ALL OWNERSHIP CHANGES)
-- ============================================================================

CREATE TABLE IF NOT EXISTS share_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transfer Parties
  from_shareholder_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  to_shareholder_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Transfer Details
  shares_transferred BIGINT NOT NULL,
  transfer_price_per_share DECIMAL(19, 4),
  -- NULL = gift, otherwise = sale price
  
  transfer_total DECIMAL(19, 2),
  -- Total consideration ($)
  
  transfer_type VARCHAR(50) NOT NULL,
  -- Type: 'founder-to-investor', 'employee-vesting', 'secondary-sale', 'gift', 'inheritance', 'other'
  
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Legal/Compliance
  transfer_status VARCHAR(50) NOT NULL DEFAULT 'completed',
  -- Status: pending, completed, cancelled, reversed
  
  shares_returned BIGINT DEFAULT 0,
  -- If transfer reversed, how many returned
  
  reason VARCHAR(500),
  notes TEXT,
  
  -- Audit Trail
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT positive_transferred CHECK (shares_transferred > 0),
  CONSTRAINT different_parties CHECK (from_shareholder_id != to_shareholder_id),
  CONSTRAINT valid_price CHECK (transfer_price_per_share IS NULL OR transfer_price_per_share > 0)
);

-- ============================================================================
-- PHASE 5: SHARE ISSUANCE TABLE (TRACK DILUTION EVENTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS share_issuances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Issuance Details
  shares_issued BIGINT NOT NULL,
  -- Number of new shares being created
  
  issued_at_price DECIMAL(19, 4),
  -- Price per share for this issuance (can differ from par value)
  
  valuation_post_issuance DECIMAL(19, 2),
  -- Company valuation after this issuance
  
  -- Recipient (who receives new shares)
  recipient_id UUID,
  -- If NULL = shares available for distribution, goes into pool
  recipient_type VARCHAR(50),
  -- Type: investor, employee-option-pool, founder, employee, advisor, convertible-note, etc.
  
  -- Justification & Approval
  issuance_reason VARCHAR(500),
  -- Reason: 'seed-round', 'series-a', 'employee-pool', 'advisor', 'debt-conversion', etc.
  
  issuance_type VARCHAR(50) NOT NULL DEFAULT 'equity',
  -- Type: equity, option, warrant, rsu, espp, other
  
  approval_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- Status: pending, approved, rejected, executed, cancelled
  
  requires_confirmation BOOLEAN DEFAULT TRUE,
  confirmation_received BOOLEAN DEFAULT FALSE,
  
  -- Dilution Information
  previous_issued_shares BIGINT,
  -- Issued shares before this issuance
  
  ownership_dilution_impact DECIMAL(5, 2),
  -- % dilution for existing shareholders
  
  -- Audit Trail
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  issued_at TIMESTAMP WITH TIME ZONE,
  
  notes TEXT,
  
  CONSTRAINT positive_issued CHECK (shares_issued > 0),
  CONSTRAINT positive_price CHECK (issued_at_price IS NULL OR issued_at_price > 0)
);

-- ============================================================================
-- PHASE 6: SHARE PRICE HISTORY (ENHANCED)
-- ============================================================================

CREATE TABLE IF NOT EXISTS share_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  date DATE NOT NULL,
  
  -- OHLC Data
  opening_price DECIMAL(19, 4),
  high_price DECIMAL(19, 4),
  low_price DECIMAL(19, 4),
  closing_price DECIMAL(19, 4) NOT NULL,
  
  -- Valuation Context
  company_valuation DECIMAL(19, 2),
  issued_shares BIGINT,
  -- Number of issued shares on this date (for cap table history)
  
  -- Event Context
  event_type VARCHAR(50),
  -- Type: market-valuation, issuance, transfer, funding-round, etc.
  event_id UUID,
  -- Reference to the event (issuance_id, transfer_id, etc.)
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT positive_closing CHECK (closing_price > 0),
  CONSTRAINT valid_ohlc CHECK (
    (opening_price IS NULL OR opening_price > 0) AND
    (high_price IS NULL OR high_price > 0) AND
    (low_price IS NULL OR low_price > 0)
  ),
  UNIQUE(date, event_type)
);

-- ============================================================================
-- PHASE 7: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_shares_config_status ON shares_config(status);
CREATE INDEX IF NOT EXISTS idx shares_config_class ON shares_config(class_type);

CREATE INDEX IF NOT EXISTS idx_shareholdings_shareholder ON shareholdings(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_shareholdings_status ON shareholdings(status);
CREATE INDEX IF NOT EXISTS idx_shareholdings_holder_type ON shareholdings(holder_type);
CREATE INDEX IF NOT EXISTS idx_shareholdings_acquisition_date ON shareholdings(acquisition_date);

CREATE INDEX IF NOT EXISTS idx_share_transfers_from ON share_transfers(from_shareholder_id);
CREATE INDEX IF NOT EXISTS idx_share_transfers_to ON share_transfers(to_shareholder_id);
CREATE INDEX IF NOT EXISTS idx_share_transfers_date ON share_transfers(transfer_date);
CREATE INDEX IF NOT EXISTS idx_share_transfers_status ON share_transfers(transfer_status);

CREATE INDEX IF NOT EXISTS idx_share_issuances_recipient ON share_issuances(recipient_id);
CREATE INDEX IF NOT EXISTS idx_share_issuances_created_by ON share_issuances(created_by_id);
CREATE INDEX IF NOT EXISTS idx_share_issuances_approval ON share_issuances(approval_status);
CREATE INDEX IF NOT EXISTS idx_share_issuances_type ON share_issuances(issuance_type);
CREATE INDEX IF NOT EXISTS idx_share_issuances_created_at ON share_issuances(created_at);

CREATE INDEX IF NOT EXISTS idx_share_price_history_date ON share_price_history(date);
CREATE INDEX IF NOT EXISTS idx_share_price_history_event ON share_price_history(event_type, event_id);

-- ============================================================================
-- PHASE 8: CREATE VIEWS FOR EASY QUERYING
-- ============================================================================

-- Cap Table View: Current ownership structure
CREATE OR REPLACE VIEW cap_table AS
SELECT
  s.shareholder_id,
  s.shareholder_name,
  s.shareholder_email,
  s.shares_owned,
  s.vested_shares,
  (s.shares_owned - s.vested_shares) as unvested_shares,
  s.share_class,
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

-- Share Authorization Status
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

-- Shareholder Dilution History
CREATE OR REPLACE VIEW shareholder_dilution_history AS
SELECT
  s.shareholder_name,
  s.shareholder_email,
  s.original_ownership_percentage,
  s.current_ownership_percentage,
  (s.original_ownership_percentage - s.current_ownership_percentage)::DECIMAL(5, 2) as total_dilution_pct,
  s.dilution_events_count,
  s.shares_owned,
  s.holder_type,
  s.acquisition_date
FROM shareholdings s
WHERE s.status IN ('active', 'vesting')
  AND s.original_ownership_percentage > s.current_ownership_percentage
ORDER BY total_dilution_pct DESC;

-- ============================================================================
-- PHASE 9: CREATE FUNCTIONS FOR OPERATIONS
-- ============================================================================

-- Function: Execute Share Transfer (no dilution, ownership change only)
CREATE OR REPLACE FUNCTION execute_share_transfer(
  p_from_id UUID,
  p_to_id UUID,
  p_shares_transferred BIGINT,
  p_transfer_price DECIMAL(19, 4) DEFAULT NULL,
  p_transfer_type VARCHAR(50) DEFAULT 'secondary-sale'
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  from_new_balance BIGINT,
  to_new_balance BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_from_shares BIGINT;
  v_to_shares BIGINT;
  v_transfer_id UUID;
BEGIN
  -- Validate sender has enough shares
  SELECT shares_owned INTO v_from_shares
  FROM shareholdings
  WHERE shareholder_id = p_from_id AND status = 'active';
  
  IF v_from_shares < p_shares_transferred THEN
    RETURN QUERY SELECT FALSE, 'Insufficient shares to transfer', 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;
  
  -- Get recipient's current shares
  SELECT COALESCE(shares_owned, 0) INTO v_to_shares
  FROM shareholdings
  WHERE shareholder_id = p_to_id AND status = 'active';
  
  -- Update sender
  UPDATE shareholdings
  SET shares_owned = shares_owned - p_shares_transferred,
      updated_at = CURRENT_TIMESTAMP
  WHERE shareholder_id = p_from_id;
  
  -- Update or insert recipient
  INSERT INTO shareholdings (
    shareholder_id, shareholder_name, shareholder_email,
    shares_owned, acquisition_date, acquisition_price,
    holder_type, status
  )
  SELECT p_to_id, full_name, email, p_shares_transferred,
         CURRENT_DATE, p_transfer_price, 'investor', 'active'
  FROM users WHERE id = p_to_id
  ON CONFLICT (shareholder_id) DO UPDATE
  SET shares_owned = shareholdings.shares_owned + p_shares_transferred;
  
  -- Record transfer
  INSERT INTO share_transfers (
    from_shareholder_id, to_shareholder_id, shares_transferred,
    transfer_price_per_share, transfer_total, transfer_type,
    transfer_status, created_by_id
  )
  VALUES (
    p_from_id, p_to_id, p_shares_transferred,
    p_transfer_price, p_transfer_price * p_shares_transferred, p_transfer_type,
    'completed', p_from_id
  );
  
  -- Return results
  SELECT shares_owned INTO v_from_shares
  FROM shareholdings WHERE shareholder_id = p_from_id;
  
  SELECT shares_owned INTO v_to_shares
  FROM shareholdings WHERE shareholder_id = p_to_id;
  
  RETURN QUERY SELECT
    TRUE,
    format('Transferred %L shares from %s to %s', p_shares_transferred, p_from_id, p_to_id),
    v_from_shares,
    v_to_shares;
END;
$$;

-- ============================================================================
-- PHASE 10: DATA MIGRATION (Optional - migrate from old tables)
-- ============================================================================

-- Insert default shares config if not exists
INSERT INTO shares_config (
  authorized_shares, issued_shares, par_value, class_type, status
)
VALUES (10000000, 1000000, 1.0, 'Common', 'active')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PHASE 11: TRIGGERS FOR AUTOMATIC CALCULATIONS
-- ============================================================================

-- Trigger: Automatically update shareholdings timestamps
CREATE OR REPLACE FUNCTION update_shareholdings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shareholdings_update_timestamp
BEFORE UPDATE ON shareholdings
FOR EACH ROW
EXECUTE FUNCTION update_shareholdings_timestamp();

-- Trigger: Update share_transfers timestamps
CREATE OR REPLACE FUNCTION update_share_transfers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER share_transfers_update_timestamp
BEFORE UPDATE ON share_transfers
FOR EACH ROW
EXECUTE FUNCTION update_share_transfers_timestamp();

-- Trigger: Update shares_config timestamps
CREATE OR REPLACE FUNCTION update_shares_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shares_config_update_timestamp
BEFORE UPDATE ON shares_config
FOR EACH ROW
EXECUTE FUNCTION update_shares_config_timestamp();

-- ============================================================================
-- PHASE 12: AUDIT ACTIONS
-- ============================================================================

ALTER TABLE audit_logs
ADD CONSTRAINT valid_action_extended CHECK (action IN (
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'LOGOUT',
  'REGISTER',
  'TOKEN_VALIDATION_FAILURE',
  'PROTECTED_ROUTE_ACCESS',
  'ROUTE_DENIED',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DELETED',
  'ROLE_CHANGED',
  'STAFF_CREATED',
  'STAFF_SUSPENDED',
  'STAFF_REACTIVATED',
  'ASSET_CREATE',
  'ASSET_CREATE_DENIED',
  'ASSET_UPDATE',
  'ASSET_UPDATE_DENIED',
  'ASSET_DELETE',
  'ASSET_DELETE_DENIED',
  'ASSET_RESTORE',
  'ASSET_LOCK',
  'ASSET_UNLOCK',
  'LIABILITY_CREATE',
  'LIABILITY_CREATE_DENIED',
  'LIABILITY_UPDATE',
  'LIABILITY_UPDATE_DENIED',
  'LIABILITY_DELETE',
  'LIABILITY_DELETE_DENIED',
  'LIABILITY_RESTORE',
  'LIABILITY_LOCK',
  'LIABILITY_UNLOCK',
  'DEAL_CREATE',
  'DEAL_CREATE_DENIED',
  'DEAL_UPDATE',
  'DEAL_UPDATE_DENIED',
  'DEAL_DELETE',
  'DEAL_DELETE_DENIED',
  'DEAL_RESTORE',
  'DEAL_LOCK',
  'DEAL_UNLOCK',
  'DEAL_STAGE_CHANGE',
  'DEAL_STAGE_CHANGE_DENIED',
  'SHARE_TRANSFER',
  'SHARE_TRANSFER_DENIED',
  'SHARE_ISSUANCE',
  'SHARE_ISSUANCE_DENIED',
  'SHARE_ISSUANCE_APPROVED',
  'SHARE_CONFIG_UPDATE',
  'SHARE_CONFIG_UPDATE_DENIED',
  'CAP_TABLE_VIEWED',
  'SHAREHOLDER_ADDED',
  'SHAREHOLDER_REMOVED',
  'VESTING_CONFIGURED',
  'VESTING_VESTED'
));

PRINT '✅ Corporate Equity System Refactor Complete!';
PRINT 'New tables created: shares_config, shareholdings, share_transfers, share_issuances';
PRINT 'Key features: Authorized vs Issued vs Allocated shares, transfers, issuance, dilution tracking';
