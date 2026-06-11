/**
 * DRAIS Integration: Pricing Configuration Table
 * 
 * This table stores pricing configurations that Consty controls
 * and serves to DRAIS for consumption.
 * 
 * This is the ONLY local storage allowed for DRAIS integration.
 * All school data must be fetched LIVE from DRAIS APIs.
 */

CREATE TABLE IF NOT EXISTS drais_pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name VARCHAR(100) NOT NULL UNIQUE,
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  features JSONB,
  description TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  is_active BOOLEAN DEFAULT TRUE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_drais_pricing_plan_name ON drais_pricing_config(plan_name);
CREATE INDEX IF NOT EXISTS idx_drais_pricing_is_active ON drais_pricing_config(is_active);

-- Table to track pricing changes (audit trail)
CREATE TABLE IF NOT EXISTS drais_pricing_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_config_id UUID REFERENCES drais_pricing_config(id) ON DELETE CASCADE,
  old_price DECIMAL(10, 2),
  new_price DECIMAL(10, 2),
  changed_by UUID,
  change_reason TEXT,
  changed_at TIMESTAMP DEFAULT NOW()
);

-- Index for audit trail
CREATE INDEX IF NOT EXISTS idx_drais_pricing_changes_config_id ON drais_pricing_changes(pricing_config_id);
CREATE INDEX IF NOT EXISTS idx_drais_pricing_changes_changed_at ON drais_pricing_changes(changed_at DESC);

-- Grant appropriate permissions
GRANT SELECT ON drais_pricing_config TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON drais_pricing_config TO authenticated;
GRANT SELECT ON drais_pricing_changes TO authenticated;
GRANT INSERT ON drais_pricing_changes TO authenticated;
