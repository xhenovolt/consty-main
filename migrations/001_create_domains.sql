/**
 * Consty Database Schema - Migration
 * 
 * Creates core domain tables for:
 * - Assets (accounting)
 * - Intellectual Property (strategic)
 * - Infrastructure (operational)
 * - Audit logging
 * 
 * Run this once during initial setup
 */

-- ============================================================================
-- ASSETS (Accounting - Tangible, Depreciable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  
  -- Identification
  name VARCHAR(255) NOT NULL,
  description TEXT,
  asset_type VARCHAR(50) NOT NULL, -- 'laptop', 'phone', 'equipment', 'furniture'
  asset_subtype VARCHAR(100),
  
  -- Financial attributes
  acquisition_cost DECIMAL(15, 2) NOT NULL,
  acquisition_date DATE NOT NULL,
  depreciation_method VARCHAR(50) NOT NULL DEFAULT 'straight_line', -- 'straight_line', 'accelerated', 'units_of_production'
  depreciation_rate DECIMAL(5, 2) NOT NULL, -- Percentage per year (e.g., 20.00)
  accumulated_depreciation DECIMAL(15, 2) NOT NULL DEFAULT 0,
  current_book_value DECIMAL(15, 2) GENERATED ALWAYS AS (acquisition_cost - accumulated_depreciation) STORED,
  residual_value DECIMAL(15, 2),
  
  -- Operational
  location VARCHAR(255),
  owner_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'deprecated', 'disposed'
  disposal_date DATE,
  disposal_value DECIMAL(15, 2),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER, -- Foreign key to users (future)
  
  CONSTRAINT asset_type_check CHECK (asset_type IN ('laptop', 'phone', 'equipment', 'furniture', 'other'))
);

CREATE INDEX idx_assets_type ON assets(asset_type);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_created_at ON assets(created_at);

-- ============================================================================
-- ASSET DEPRECIATION LOG (Audit trail for asset value changes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_depreciation_logs (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  
  -- Depreciation period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  depreciation_amount DECIMAL(15, 2) NOT NULL,
  
  -- Calculation metadata
  calculation_method VARCHAR(100),
  useful_life_years INTEGER,
  units_produced INTEGER,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  notes TEXT
);

CREATE INDEX idx_depreciation_asset ON asset_depreciation_logs(asset_id);
CREATE INDEX idx_depreciation_period ON asset_depreciation_logs(period_start, period_end);

-- ============================================================================
-- INTELLECTUAL PROPERTY (Strategic, Revenue-generating)
-- ============================================================================

CREATE TABLE IF NOT EXISTS intellectual_property (
  id SERIAL PRIMARY KEY,
  
  -- Identification
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  ip_type VARCHAR(50) NOT NULL, -- 'software', 'internal_system', 'licensed_ip', 'brand'
  ip_subtype VARCHAR(100),
  
  -- Financial attributes
  development_cost DECIMAL(15, 2) NOT NULL,
  development_start_date DATE,
  development_completion_date DATE,
  valuation_estimate DECIMAL(15, 2), -- Manual, updated during strategic reviews
  valuation_basis VARCHAR(100), -- 'cost', 'market', 'revenue_multiple', 'custom'
  
  -- Revenue attributes
  revenue_generated_lifetime DECIMAL(15, 2) DEFAULT 0,
  revenue_generated_monthly DECIMAL(15, 2) DEFAULT 0,
  clients_count INTEGER DEFAULT 0,
  monetization_model VARCHAR(50), -- 'license', 'saas', 'one_time', 'freemium'
  
  -- Ownership
  ownership_percentage DECIMAL(5, 2) DEFAULT 100, -- For co-owned IP
  owner_name VARCHAR(255),
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'scaling', 'maintenance', 'deprecated', 'archived'
  launch_date DATE,
  sunset_date DATE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  
  CONSTRAINT ip_type_check CHECK (ip_type IN ('software', 'internal_system', 'licensed_ip', 'brand', 'other'))
);

CREATE INDEX idx_ip_type ON intellectual_property(ip_type);
CREATE INDEX idx_ip_status ON intellectual_property(status);
CREATE INDEX idx_ip_created_at ON intellectual_property(created_at);

-- ============================================================================
-- IP VALUATION LOG (Audit trail for valuation changes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ip_valuation_logs (
  id SERIAL PRIMARY KEY,
  ip_id INTEGER NOT NULL REFERENCES intellectual_property(id) ON DELETE RESTRICT,
  
  -- Valuation
  previous_valuation DECIMAL(15, 2),
  new_valuation DECIMAL(15, 2) NOT NULL,
  valuation_basis VARCHAR(100),
  
  -- Context
  reason VARCHAR(255), -- 'monthly_review', 'funding_round', 'performance_update', 'market_event'
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER
);

CREATE INDEX idx_valuation_ip ON ip_valuation_logs(ip_id);
CREATE INDEX idx_valuation_created_at ON ip_valuation_logs(created_at);

-- ============================================================================
-- INFRASTRUCTURE (Operational, Risk-Critical)
-- ============================================================================

CREATE TABLE IF NOT EXISTS infrastructure (
  id SERIAL PRIMARY KEY,
  
  -- Identification
  name VARCHAR(255) NOT NULL,
  description TEXT,
  infrastructure_type VARCHAR(50) NOT NULL, -- 'brand', 'website', 'domain', 'social_media', 'design_system'
  
  -- Ownership & Access
  owner_name VARCHAR(255),
  access_level VARCHAR(50), -- 'restricted', 'limited', 'full'
  
  -- Risk & Value
  risk_level VARCHAR(50), -- 'critical', 'high', 'medium', 'low'
  replacement_cost DECIMAL(15, 2),
  
  -- Infrastructure-specific metadata
  -- For domains
  domain_name VARCHAR(255),
  domain_registrar VARCHAR(100),
  domain_expiry_date DATE,
  domain_auto_renew BOOLEAN DEFAULT TRUE,
  
  -- For social media
  platform VARCHAR(100), -- 'instagram', 'twitter', 'linkedin', 'tiktok', etc.
  social_handle VARCHAR(255),
  social_recovery_email VARCHAR(255),
  social_recovery_phone VARCHAR(20),
  
  -- For brand & design systems
  file_location VARCHAR(500), -- URL or path
  version VARCHAR(50),
  
  -- General
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'archived', 'deprecated'
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  
  CONSTRAINT infra_type_check CHECK (infrastructure_type IN ('brand', 'website', 'domain', 'social_media', 'design_system', 'other'))
);

CREATE INDEX idx_infra_type ON infrastructure(infrastructure_type);
CREATE INDEX idx_infra_risk ON infrastructure(risk_level);
CREATE INDEX idx_infra_status ON infrastructure(status);

-- ============================================================================
-- INFRASTRUCTURE AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS infrastructure_audit_logs (
  id SERIAL PRIMARY KEY,
  infrastructure_id INTEGER NOT NULL REFERENCES infrastructure(id) ON DELETE RESTRICT,
  
  -- Event
  event_type VARCHAR(100), -- 'access_granted', 'password_rotated', 'recovery_updated', 'risk_reassessed'
  previous_value TEXT,
  new_value TEXT,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  notes TEXT
);

CREATE INDEX idx_infra_audit_infrastructure ON infrastructure_audit_logs(infrastructure_id);
CREATE INDEX idx_infra_audit_created_at ON infrastructure_audit_logs(created_at);

-- ============================================================================
-- VALUATION SUMMARY (Computed, for dashboard)
-- ============================================================================

CREATE TABLE IF NOT EXISTS valuation_summary (
  id SERIAL PRIMARY KEY,
  
  -- Accounting valuation
  total_assets_book_value DECIMAL(15, 2),
  total_depreciation_period DECIMAL(15, 2),
  
  -- Strategic valuation
  total_ip_valuation DECIMAL(15, 2),
  total_infrastructure_value DECIMAL(15, 2),
  
  -- Computed net worth
  accounting_net_worth DECIMAL(15, 2),
  strategic_company_value DECIMAL(15, 2),
  
  -- Timestamp
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT only_one_row CHECK (id = 1)
);

-- ============================================================================
-- TRIGGER: Update updated_at on asset changes
-- ============================================================================

CREATE OR REPLACE FUNCTION update_asset_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER asset_update_timestamp
BEFORE UPDATE ON assets
FOR EACH ROW
EXECUTE FUNCTION update_asset_timestamp();

-- ============================================================================
-- TRIGGER: Update updated_at on IP changes
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ip_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ip_update_timestamp
BEFORE UPDATE ON intellectual_property
FOR EACH ROW
EXECUTE FUNCTION update_ip_timestamp();

-- ============================================================================
-- TRIGGER: Update updated_at on infrastructure changes
-- ============================================================================

CREATE OR REPLACE FUNCTION update_infrastructure_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER infrastructure_update_timestamp
BEFORE UPDATE ON infrastructure
FOR EACH ROW
EXECUTE FUNCTION update_infrastructure_timestamp();
