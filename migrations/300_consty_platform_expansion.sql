-- ============================================================================
-- MIGRATION 300: CONSTY FOUNDER OS - TARGETED SCHEMA EXPANSION
-- Date: 2026-03-10
--
-- Based on actual live DB state. All changes are precise and targeted.
-- Safe to run: uses IF NOT EXISTS everywhere.
-- ============================================================================

-- ============================================================================
-- 1. FIX PROSPECTS TABLE
-- ============================================================================

-- Add prospect_type (missing from earlier failed run)
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS prospect_type VARCHAR(50) DEFAULT 'organization';

-- Fix source constraint to include manual_entry
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_source_check;
ALTER TABLE prospects
  ADD CONSTRAINT prospects_source_check
  CHECK (source IS NULL OR source IN (
    'referral', 'cold_outreach', 'inbound', 'event', 'social_media',
    'website', 'partner', 'manual_entry', 'walk_in', 'phone', 'other'
  ));

-- ============================================================================
-- 2. ADD COLUMNS TO EXISTING SYSTEMS TABLE
-- ============================================================================

ALTER TABLE systems ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
ALTER TABLE systems ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE systems ADD COLUMN IF NOT EXISTS tech_stack TEXT;
ALTER TABLE systems ADD COLUMN IF NOT EXISTS repository_url VARCHAR(500);
ALTER TABLE systems ADD COLUMN IF NOT EXISTS demo_url VARCHAR(500);
ALTER TABLE systems ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE systems ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- 3. CREATE SYSTEM PRICING PLANS (doesn't exist yet)
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_pricing_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  installation_fee NUMERIC(15,2) DEFAULT 0,
  monthly_fee NUMERIC(15,2),
  annual_fee NUMERIC(15,2),
  currency VARCHAR(3) NOT NULL DEFAULT 'UGX',
  billing_cycle VARCHAR(20) DEFAULT 'monthly',
  features JSONB DEFAULT '[]',
  max_users INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_plans_system ON system_pricing_plans(system_id);
CREATE INDEX IF NOT EXISTS idx_pricing_plans_active ON system_pricing_plans(is_active);

-- ============================================================================
-- 4. EXPAND SYSTEM_ISSUES AND SYSTEM_CHANGES
-- ============================================================================

ALTER TABLE system_issues ADD COLUMN IF NOT EXISTS severity VARCHAR(30) DEFAULT 'medium';
ALTER TABLE system_issues ADD COLUMN IF NOT EXISTS reported_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE system_issues ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE system_changes ADD COLUMN IF NOT EXISTS change_type VARCHAR(50) DEFAULT 'feature';
ALTER TABLE system_changes ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE system_changes ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- 5. ADD COLUMNS TO SERVICES TABLE
-- ============================================================================

ALTER TABLE services ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(30);
ALTER TABLE services ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- 6. EXPAND DEALS TABLE FOR FLEXIBLE PAYMENTS
-- ============================================================================

ALTER TABLE deals ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES system_pricing_plans(id) ON DELETE SET NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS original_price NUMERIC(15,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS negotiated_price NUMERIC(15,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS installation_fee NUMERIC(15,2) DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS upfront_paid NUMERIC(15,2) DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage VARCHAR(50) DEFAULT 'qualification';
ALTER TABLE deals ALTER COLUMN currency SET DEFAULT 'UGX';

-- The existing status_check already includes closed_won but not closed_lost
-- Drop and recreate to ensure complete list
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_status_check;
ALTER TABLE deals
  ADD CONSTRAINT deals_status_check
  CHECK (status IN (
    'draft', 'sent', 'accepted', 'negotiation', 'in_progress',
    'payment_pending', 'completed', 'closed_won', 'closed_lost',
    'cancelled', 'disputed'
  ));

-- ============================================================================
-- 7. EXPAND LICENSES TABLE
-- ============================================================================

ALTER TABLE licenses ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS license_key VARCHAR(255);
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES system_pricing_plans(id) ON DELETE SET NULL;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS features_enabled JSONB DEFAULT '{}';
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS max_users INTEGER;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS issued_by UUID REFERENCES users(id) ON DELETE SET NULL;
-- Note: table has start_date and is_historical already

-- ============================================================================
-- 8. EXPAND OPERATIONS TABLE
-- The existing table has: id, operation_type, description, related_system_id,
-- related_deal_id, notes, created_at
-- We need to add many new columns for proper tracking.
-- ============================================================================

ALTER TABLE operations ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE operations ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'other';
ALTER TABLE operations ADD COLUMN IF NOT EXISTS expense_type VARCHAR(30) DEFAULT 'operational';
ALTER TABLE operations ADD COLUMN IF NOT EXISTS amount NUMERIC(15,2);
ALTER TABLE operations ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'UGX';
ALTER TABLE operations ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS ledger_entry_id UUID REFERENCES ledger(id) ON DELETE SET NULL;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS operation_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS vendor VARCHAR(255);
ALTER TABLE operations ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Populate title from description for existing rows
UPDATE operations SET title = COALESCE(description, operation_type) WHERE title IS NULL;
-- Populate category from operation_type for existing rows
UPDATE operations SET category = CASE
  WHEN operation_type = 'transport' THEN 'transport'
  WHEN operation_type = 'marketing' THEN 'marketing'
  WHEN operation_type = 'prospecting' THEN 'prospecting'
  ELSE 'other'
END WHERE category IS NULL OR category = 'other';

CREATE INDEX IF NOT EXISTS idx_operations_category ON operations(category);
CREATE INDEX IF NOT EXISTS idx_operations_date ON operations(operation_date);
CREATE INDEX IF NOT EXISTS idx_operations_account ON operations(account_id);
CREATE INDEX IF NOT EXISTS idx_operations_created_by ON operations(created_by);

-- ============================================================================
-- 9. EXPAND ASSETS TABLE
-- Existing: id, name, value, currency, description, created_at
-- ============================================================================

ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type VARCHAR(100) DEFAULT 'equipment';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS cost NUMERIC(15,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS current_value NUMERIC(15,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS acquisition_date DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_historical BOOLEAN DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS account_deducted_from UUID REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ledger_entry_id UUID REFERENCES ledger(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS condition VARCHAR(30) DEFAULT 'good';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS serial_number VARCHAR(255);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Copy value to current_value and cost for existing rows
UPDATE assets SET cost = value, current_value = value WHERE cost IS NULL AND value IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_created_by ON assets(created_by);

-- ============================================================================
-- 10. EXPAND USER_PRESENCE TABLE
-- Existing: user_id, last_ping, last_seen, status
-- ============================================================================

ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS current_route VARCHAR(500);
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS current_page_title VARCHAR(255);
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Sync is_online from existing status column
UPDATE user_presence SET is_online = (status = 'online') WHERE is_online IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_presence_is_online ON user_presence(is_online);
CREATE INDEX IF NOT EXISTS idx_user_presence_route ON user_presence(current_route);

-- ============================================================================
-- 11. CREATE ACTIVITY LOGS TABLE (doesn't exist yet)
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL DEFAULT 'page_view',
  entity_type VARCHAR(100),
  entity_id UUID,
  route VARCHAR(500),
  page_title VARCHAR(255),
  details JSONB DEFAULT '{}',
  session_id UUID,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);

-- ============================================================================
-- 12. CREATE SYSTEM SETTINGS TABLE (doesn't exist yet)
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_settings (key, value, description) VALUES
  ('default_currency', 'UGX', 'Default currency for all monetary values'),
  ('company_name', 'Consty', 'Company name for reports and invoices'),
  ('license_warn_backdated', 'true', 'Show warning when creating backdated licenses'),
  ('online_threshold_minutes', '2', 'Minutes before marking user offline (heartbeat)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 13. FIX CURRENCY DEFAULTS (USD → UGX)
-- ============================================================================

ALTER TABLE accounts ALTER COLUMN currency SET DEFAULT 'UGX';
ALTER TABLE payments ALTER COLUMN currency SET DEFAULT 'UGX';
ALTER TABLE expenses ALTER COLUMN currency SET DEFAULT 'UGX';
ALTER TABLE ledger ALTER COLUMN currency SET DEFAULT 'UGX';

DO $$
BEGIN
  ALTER TABLE clients ALTER COLUMN preferred_currency SET DEFAULT 'UGX';
EXCEPTION WHEN undefined_column THEN NULL;
END$$;

DO $$
BEGIN
  ALTER TABLE offerings ALTER COLUMN currency SET DEFAULT 'UGX';
EXCEPTION WHEN undefined_column THEN NULL;
END$$;

-- ============================================================================
-- 14. EXPAND BUDGETS TABLE
-- ============================================================================

ALTER TABLE budgets ADD COLUMN IF NOT EXISTS allocation_percentage NUMERIC(5,2);
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS expected_purchase_date DATE;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS items_needed TEXT;

-- ============================================================================
-- 15. EXPAND PERMISSIONS TABLE
-- ============================================================================

INSERT INTO permissions (module, action, description)
SELECT module, action, description FROM (VALUES
  ('prospects', 'view', 'View prospects list and details'),
  ('prospects', 'create', 'Create new prospects'),
  ('prospects', 'edit', 'Edit prospect details'),
  ('prospects', 'delete', 'Delete prospects'),
  ('deals', 'view', 'View deals'),
  ('deals', 'create', 'Create new deals'),
  ('deals', 'edit', 'Edit deals'),
  ('deals', 'delete', 'Delete deals'),
  ('finance', 'view', 'View financial data'),
  ('finance', 'edit', 'Record payments and expenses'),
  ('finance', 'reports', 'Access financial reports'),
  ('systems', 'view', 'View systems'),
  ('systems', 'manage', 'Create and edit systems'),
  ('licenses', 'view', 'View licenses'),
  ('licenses', 'issue', 'Issue new licenses'),
  ('users', 'view', 'View user list'),
  ('users', 'manage', 'Create and manage users'),
  ('settings', 'view', 'View settings'),
  ('settings', 'manage', 'Change system settings'),
  ('operations', 'view', 'View operations'),
  ('operations', 'create', 'Record operation expenses'),
  ('assets', 'view', 'View assets'),
  ('assets', 'manage', 'Add and manage assets'),
  ('services', 'view', 'View services'),
  ('services', 'manage', 'Create and manage services')
) AS v(module, action, description)
WHERE NOT EXISTS (
  SELECT 1 FROM permissions p WHERE p.module = v.module AND p.action = v.action
);

-- ============================================================================
-- 16. UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_systems_updated_at ON systems;
CREATE TRIGGER trg_systems_updated_at
  BEFORE UPDATE ON systems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_services_updated_at ON services;
CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_pricing_plans_updated_at ON system_pricing_plans;
CREATE TRIGGER trg_pricing_plans_updated_at
  BEFORE UPDATE ON system_pricing_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_licenses_updated_at ON licenses;
CREATE TRIGGER trg_licenses_updated_at
  BEFORE UPDATE ON licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_operations_updated_at ON operations;
CREATE TRIGGER trg_operations_updated_at
  BEFORE UPDATE ON operations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_assets_updated_at ON assets;
CREATE TRIGGER trg_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 300: Consty Platform Expansion — Complete!';
END$$;
