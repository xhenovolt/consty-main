-- =============================================================================
-- CONSTY PLATFORM MODEL — Migration 202
-- Date: 2026-03-09
--
-- Adds:
--   1. systems            — Platforms managed in Consty
--   2. system_changes     — Architectural changes / updates to systems
--   3. system_issues      — Bug / problem tracker per system
--   4. system_operations  — Operational log (dev, deploy, test, fix)
--   5. licenses           — License registry (auto-issued on deal closure)
--   6. services           — One-time or recurring services sold to clients
--   7. operations         — Daily operations log
--   8. allocations        — Payment allocation tracker (where shillings go)
--   ALTER deals           — Add system_id, service_id, client_name
--   ALTER prospects       — Add system_id, service_id
--   ALTER accounts        — Default currency UGX
-- =============================================================================

-- =============================================================================
-- 1. SYSTEMS — Software platforms managed and sold through Consty
-- =============================================================================

CREATE TABLE IF NOT EXISTS systems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'development', 'deprecated', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_systems_name ON systems(name);
CREATE INDEX IF NOT EXISTS idx_systems_status ON systems(status);

-- Trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_systems_updated_at') THEN
    CREATE TRIGGER trg_systems_updated_at
      BEFORE UPDATE ON systems
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Seed primary managed systems
INSERT INTO systems (name, description, status) VALUES
  ('Consty', 'Construction and project management platform', 'active')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 2. SYSTEM CHANGES — Version / architecture changes to a system
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_changes_system_id ON system_changes(system_id);
CREATE INDEX IF NOT EXISTS idx_system_changes_status ON system_changes(status);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_system_changes_updated_at') THEN
    CREATE TRIGGER trg_system_changes_updated_at
      BEFORE UPDATE ON system_changes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- =============================================================================
-- 3. SYSTEM ISSUES — Bug and problem tracker per system
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'fixed', 'closed')),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_issues_system_id ON system_issues(system_id);
CREATE INDEX IF NOT EXISTS idx_system_issues_status ON system_issues(status);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_system_issues_updated_at') THEN
    CREATE TRIGGER trg_system_issues_updated_at
      BEFORE UPDATE ON system_issues
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- =============================================================================
-- 4. SYSTEM OPERATIONS — Operational activity log per system
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  operation_type VARCHAR(50) NOT NULL
    CHECK (operation_type IN (
      'development', 'bug_fix', 'testing', 'deployment',
      'architecture_change', 'maintenance', 'update', 'other'
    )),
  description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'completed'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_system_operations_system_id ON system_operations(system_id);
CREATE INDEX IF NOT EXISTS idx_system_operations_type ON system_operations(operation_type);

-- =============================================================================
-- 5. LICENSES — License registry (auto-issued when a system deal closes)
-- =============================================================================

CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_id UUID REFERENCES systems(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  client_name VARCHAR(255) NOT NULL,
  license_type VARCHAR(50) NOT NULL DEFAULT 'lifetime'
    CHECK (license_type IN ('lifetime', 'annual', 'monthly', 'trial')),
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,   -- supports historical entry
  is_historical BOOLEAN NOT NULL DEFAULT false,     -- true = backdated entry
  start_date DATE,
  end_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'suspended', 'revoked')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_licenses_system_id ON licenses(system_id);
CREATE INDEX IF NOT EXISTS idx_licenses_deal_id ON licenses(deal_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_issued_date ON licenses(issued_date);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_licenses_updated_at') THEN
    CREATE TRIGGER trg_licenses_updated_at
      BEFORE UPDATE ON licenses
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- =============================================================================
-- 6. SERVICES — One-time or recurring services sold to clients
-- =============================================================================

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  service_type VARCHAR(30) NOT NULL DEFAULT 'one_time'
    CHECK (service_type IN ('one_time', 'recurring')),
  price NUMERIC(15,2),
  currency VARCHAR(3) NOT NULL DEFAULT 'UGX',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_type ON services(service_type);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_services_updated_at') THEN
    CREATE TRIGGER trg_services_updated_at
      BEFORE UPDATE ON services
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Seed sample services
INSERT INTO services (name, description, service_type, price, currency) VALUES
  ('Web Development', 'Custom website or web application development', 'one_time', 1000000, 'UGX'),
  ('System Customization', 'Custom features added to existing systems', 'one_time', 500000, 'UGX'),
  ('Data Migration', 'Migration of client data to new systems', 'one_time', 300000, 'UGX'),
  ('System Support', 'Ongoing technical support and maintenance', 'recurring', 200000, 'UGX')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 7. OPERATIONS — Founder daily workflow tracker
-- =============================================================================

CREATE TABLE IF NOT EXISTS operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation_type VARCHAR(50) NOT NULL
    CHECK (operation_type IN (
      'coding', 'debugging', 'testing', 'deployment',
      'sales_meeting', 'prospecting', 'follow_up',
      'payment_collection', 'financial_allocation', 'other'
    )),
  description TEXT NOT NULL,
  related_system_id UUID REFERENCES systems(id) ON DELETE SET NULL,
  related_deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operations_type ON operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_operations_system_id ON operations(related_system_id);
CREATE INDEX IF NOT EXISTS idx_operations_deal_id ON operations(related_deal_id);
CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations(created_at);

-- =============================================================================
-- 8. ALLOCATIONS — Where received payments are allocated
-- =============================================================================

CREATE TABLE IF NOT EXISTS allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL
    CHECK (category IN (
      'data', 'software_tools', 'hosting', 'food', 'transport',
      'operations', 'savings', 'rent', 'hardware', 'marketing',
      'salaries', 'taxes', 'other'
    )),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'UGX',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allocations_payment_id ON allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_category ON allocations(category);

-- =============================================================================
-- 9. ALTER DEALS — Add system_id, service_id, client_name
-- =============================================================================

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS system_id UUID REFERENCES systems(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_name VARCHAR(255);

-- Extend status to include closed_won, payment_pending, negotiation
DO $$ BEGIN
  ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_status_check;
  ALTER TABLE deals ADD CONSTRAINT deals_status_check
    CHECK (status IN (
      'draft', 'sent', 'accepted', 'negotiation', 'in_progress',
      'payment_pending', 'completed', 'closed_won', 'cancelled', 'disputed'
    ));
EXCEPTION WHEN others THEN
  NULL; -- ignore if constraint already has the values
END $$;

CREATE INDEX IF NOT EXISTS idx_deals_system_id ON deals(system_id);
CREATE INDEX IF NOT EXISTS idx_deals_service_id ON deals(service_id);

-- Fix default currency on deals to UGX
ALTER TABLE deals ALTER COLUMN currency SET DEFAULT 'UGX';

-- =============================================================================
-- 10. ALTER PROSPECTS — Add system_id, service_id
-- =============================================================================

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS system_id UUID REFERENCES systems(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prospects_system_id ON prospects(system_id);
CREATE INDEX IF NOT EXISTS idx_prospects_service_id ON prospects(service_id);

-- Fix default currency on prospects to UGX
ALTER TABLE prospects ALTER COLUMN currency SET DEFAULT 'UGX';

-- =============================================================================
-- 11. FIX DEFAULT CURRENCIES — All financial tables default to UGX
-- =============================================================================

ALTER TABLE accounts ALTER COLUMN currency SET DEFAULT 'UGX';
ALTER TABLE payments ALTER COLUMN currency SET DEFAULT 'UGX';
ALTER TABLE expenses ALTER COLUMN currency SET DEFAULT 'UGX';
ALTER TABLE ledger   ALTER COLUMN currency SET DEFAULT 'UGX';
ALTER TABLE transfers ALTER COLUMN currency SET DEFAULT 'UGX';
ALTER TABLE budgets  ALTER COLUMN currency SET DEFAULT 'UGX';
ALTER TABLE clients  ALTER COLUMN preferred_currency SET DEFAULT 'UGX';

-- =============================================================================
-- 12. ADD missing columns to payments for deal view
-- =============================================================================

-- Add payment_date column if missing (used by new payments API)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- =============================================================================
-- MIGRATION 202 COMPLETE
-- Tables added: systems, system_changes, system_issues, system_operations,
--               licenses, services, operations, allocations
-- Altered: deals (system_id, service_id, client_name), prospects (system_id, service_id)
-- Fixed: default currency UGX across all financial tables
-- =============================================================================
