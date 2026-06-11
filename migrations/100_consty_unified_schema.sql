/**
 * Consty Construction Operations Schema
 * 
 * ARCHITECTURE:
 * prospects → clients → deals → contracts → payments → allocations → profit
 * 
 * ALL TABLES USE IF NOT EXISTS FOR IDEMPOTENCY
 * Safe to run multiple times
 */

-- ============================================================================
-- EXTENSION: UUID SUPPORT
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE 1: USERS (Foundation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP,
  is_online BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE 2: PROSPECT REFERENCE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS prospect_sources (
  id SERIAL PRIMARY KEY,
  source_name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO prospect_sources (source_name, description) VALUES
  ('Cold Call', 'Outbound prospecting call'),
  ('Referral', 'Referred by existing contact'),
  ('Event', 'Conference or networking event'),
  ('Walk-in', 'Unsolicited inquiry'),
  ('Website', 'Inbound from website'),
  ('Social Media', 'LinkedIn, Twitter, etc'),
  ('Email', 'Inbound email inquiry'),
  ('Partner', 'Business partner referral'),
  ('Other', 'Other source')
ON CONFLICT (source_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS prospect_industries (
  id SERIAL PRIMARY KEY,
  industry_name VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO prospect_industries (industry_name, category) VALUES
  ('Education', 'Service'),
  ('Technology', 'Tech'),
  ('Healthcare', 'Service'),
  ('Finance', 'Service'),
  ('Manufacturing', 'Product'),
  ('Retail', 'Product'),
  ('Real Estate', 'Service'),
  ('Consulting', 'Service'),
  ('Hospitality', 'Service'),
  ('Government', 'Public'),
  ('Non-Profit', 'Public'),
  ('Other', 'Other')
ON CONFLICT (industry_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS prospect_stages (
  id SERIAL PRIMARY KEY,
  stage_name VARCHAR(50) UNIQUE NOT NULL,
  stage_order INT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO prospect_stages (stage_name, stage_order, description) VALUES
  ('Cold', 1, 'Initial contact identified'),
  ('Contacted', 2, 'First contact made'),
  ('Warm', 3, 'Shows interest'),
  ('Negotiating', 4, 'Active negotiation'),
  ('Converted', 5, 'Converted to client')
ON CONFLICT (stage_name) DO NOTHING;

-- ============================================================================
-- TABLE 3: PROSPECTS (Core CRM Entity)
-- ============================================================================

CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  prospect_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone_number VARCHAR(50),
  whatsapp_number VARCHAR(50),
  
  -- Organization
  company_name VARCHAR(255),
  industry_id INT REFERENCES prospect_industries(id) ON DELETE SET NULL,
  
  -- Location
  city VARCHAR(100),
  country VARCHAR(100),
  address TEXT,
  
  -- Pipeline
  source_id INT REFERENCES prospect_sources(id) ON DELETE SET NULL,
  current_stage_id INT REFERENCES prospect_stages(id) ON DELETE SET NULL DEFAULT 1,
  
  -- Assignment
  assigned_sales_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Activity Tracking
  first_contacted_at TIMESTAMP,
  last_activity_at TIMESTAMP,
  next_followup_at TIMESTAMP,
  
  -- Notes
  notes TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'converted', 'disqualified')),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prospects_stage ON prospects(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_followup ON prospects(next_followup_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_prospects_created ON prospects(created_at DESC);

-- ============================================================================
-- TABLE 4: PROSPECT ACTIVITIES (Timeline/Follow-ups)
-- ============================================================================

CREATE TABLE IF NOT EXISTS prospect_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  
  -- Activity Type
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    'call', 'email', 'meeting', 'message', 'note', 'stage_change', 
    'follow_up_set', 'deal_created', 'converted'
  )),
  
  -- Content
  subject VARCHAR(255),
  description TEXT,
  outcome VARCHAR(255),
  notes TEXT,
  
  -- Scheduling
  next_followup_date DATE,
  duration_minutes INT,
  
  -- Tracking
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  activity_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activities_prospect ON prospect_activities(prospect_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON prospect_activities(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON prospect_activities(activity_type);

-- ============================================================================
-- TABLE 5: CLIENTS (Converted Prospects)
-- ============================================================================

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to prospect (required for conversion flow)
  prospect_id UUID UNIQUE REFERENCES prospects(id) ON DELETE SET NULL,
  
  -- Client Details
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  company_name VARCHAR(255),
  address TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'churned')),
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  converted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_prospect ON clients(prospect_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

-- ============================================================================
-- TABLE 6: INTELLECTUAL PROPERTY (Systems/Products)
-- ============================================================================

CREATE TABLE IF NOT EXISTS intellectual_property (
  id SERIAL PRIMARY KEY,
  
  -- Identity
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  ip_type VARCHAR(50) DEFAULT 'system' CHECK (ip_type IN ('system', 'product', 'service', 'patent', 'trademark')),
  
  -- Classification
  category VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'development', 'deprecated', 'archived')),
  
  -- Pricing
  base_price DECIMAL(15, 2),
  recurring_price DECIMAL(15, 2),
  recurring_cycle VARCHAR(20) CHECK (recurring_cycle IN ('monthly', 'quarterly', 'yearly')),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default Consty systems
INSERT INTO intellectual_property (name, description, ip_type, status) VALUES
  ('DRAIS', 'Digital Resource and Intelligence System', 'system', 'active'),
  ('RISE', 'Remote Intelligence Support Engine', 'system', 'active'),
  ('XHAIRA', 'Extended Human AI Research Assistant', 'system', 'active'),
  ('CONSTY', 'Construction Technology Platform', 'system', 'active')
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_ip_type ON intellectual_property(ip_type);
CREATE INDEX IF NOT EXISTS idx_ip_status ON intellectual_property(status);

-- ============================================================================
-- TABLE 7: DEALS (Sales Pipeline)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Title and Description
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Relationships (at least one required)
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  system_id INT REFERENCES intellectual_property(id) ON DELETE RESTRICT,
  
  -- Client name (for display when prospect/client not linked)
  client_name VARCHAR(255),
  
  -- Financial
  value_estimate DECIMAL(15, 2) NOT NULL DEFAULT 0,
  probability INT DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
  expected_revenue DECIMAL(15, 2) GENERATED ALWAYS AS (value_estimate * probability / 100) STORED,
  
  -- Pipeline
  stage VARCHAR(50) DEFAULT 'Qualification' CHECK (stage IN (
    'Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost'
  )),
  expected_close_date DATE,
  
  -- Status
  deleted_at TIMESTAMP,
  
  -- Tracking
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_system ON deals(system_id);
CREATE INDEX IF NOT EXISTS idx_deals_client ON deals(client_id);
CREATE INDEX IF NOT EXISTS idx_deals_prospect ON deals(prospect_id);
CREATE INDEX IF NOT EXISTS idx_deals_created ON deals(created_at DESC);

-- ============================================================================
-- TABLE 8: CONTRACTS (Won Deals become Contracts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Required Relationships
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  system_id INT NOT NULL REFERENCES intellectual_property(id) ON DELETE RESTRICT,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  
  -- Financials
  installation_fee DECIMAL(15, 2) NOT NULL DEFAULT 0,
  recurring_enabled BOOLEAN DEFAULT FALSE,
  recurring_cycle VARCHAR(20) CHECK (recurring_cycle IN ('monthly', 'quarterly', 'yearly')),
  recurring_amount DECIMAL(15, 2),
  
  -- Terms
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  installation_date DATE,
  terms TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'terminated', 'expired')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_system ON contracts(system_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- ============================================================================
-- TABLE 9: PAYMENTS (Money Received)
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Required Relationship
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  
  -- Payment Details
  amount_received DECIMAL(15, 2) NOT NULL CHECK (amount_received > 0),
  date_received TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  payment_method VARCHAR(50) DEFAULT 'bank_transfer' CHECK (payment_method IN (
    'cash', 'bank_transfer', 'mobile_money', 'check', 'card', 'crypto', 'other'
  )),
  
  -- Allocation Tracking
  allocated_amount DECIMAL(15, 2) DEFAULT 0,
  allocation_status VARCHAR(20) DEFAULT 'pending' CHECK (allocation_status IN ('pending', 'partial', 'allocated')),
  
  -- Reference
  reference_number VARCHAR(100),
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_contract ON payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date_received DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(allocation_status);

-- ============================================================================
-- TABLE 10: EXPENSE CATEGORIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO expense_categories (name, description, is_system) VALUES
  ('Operations', 'Day-to-day operational expenses', TRUE),
  ('Salaries', 'Employee compensation', TRUE),
  ('Software', 'Software subscriptions and licenses', TRUE),
  ('Hardware', 'Equipment and hardware purchases', TRUE),
  ('Marketing', 'Marketing and advertising', TRUE),
  ('Travel', 'Travel and accommodation', TRUE),
  ('Infrastructure', 'Hosting, servers, cloud services', TRUE),
  ('Professional Services', 'Legal, accounting, consulting', TRUE),
  ('Utilities', 'Office utilities', TRUE),
  ('Other', 'Miscellaneous expenses', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- TABLE 11: ALLOCATIONS (Where Money Goes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source Payment
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  
  -- Allocation Type
  allocation_type VARCHAR(50) NOT NULL CHECK (allocation_type IN (
    'expense', 'vault', 'operating', 'investment', 'dividend', 'custom'
  )),
  
  -- Amount
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  
  -- Category (for expenses)
  category_id INT REFERENCES expense_categories(id) ON DELETE SET NULL,
  custom_category VARCHAR(100),
  
  -- Description
  description TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_allocations_payment ON allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_type ON allocations(allocation_type);

-- ============================================================================
-- TABLE 12: EXPENSES (Standalone Expense Records)
-- ============================================================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Category
  category_id INT REFERENCES expense_categories(id) ON DELETE SET NULL,
  custom_category VARCHAR(100),
  
  -- Details
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  expense_date DATE DEFAULT CURRENT_DATE,
  
  -- Optional link to allocation
  allocation_id UUID REFERENCES allocations(id) ON DELETE SET NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'recorded' CHECK (status IN ('recorded', 'approved', 'disputed')),
  
  -- Timestamps
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);

-- ============================================================================
-- TABLE 13: VAULT (Savings/Reserve Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vault_balances (
  id SERIAL PRIMARY KEY,
  vault_type VARCHAR(50) NOT NULL UNIQUE CHECK (vault_type IN ('savings', 'emergency', 'investment', 'operating')),
  balance DECIMAL(15, 2) DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO vault_balances (vault_type, balance) VALUES
  ('savings', 0),
  ('emergency', 0),
  ('investment', 0),
  ('operating', 0)
ON CONFLICT (vault_type) DO NOTHING;

-- ============================================================================
-- TABLE 14: INVOICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Invoice Number
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Client
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  
  -- Amounts
  subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(15, 2) DEFAULT 0,
  amount_due DECIMAL(15, 2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  
  -- Dates
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled')),
  
  -- Details
  notes TEXT,
  terms TEXT,
  
  -- Timestamps
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_date);

-- ============================================================================
-- TABLE 15: INVOICE ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  
  -- Item Details
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) DEFAULT 1,
  unit_price DECIMAL(15, 2) NOT NULL,
  amount DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  -- References
  system_id INT REFERENCES intellectual_property(id) ON DELETE SET NULL,
  
  -- Order
  sort_order INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- ============================================================================
-- TABLE 16: SALES (Legacy/Unified Revenue Records)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Customer Info
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  
  -- Links
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  
  -- Financial
  total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_paid DECIMAL(15, 2) DEFAULT 0,
  remaining_balance DECIMAL(15, 2) DEFAULT 0,
  
  -- Status
  status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid', 'Partially Paid', 'Cancelled')),
  payment_status VARCHAR(50) DEFAULT 'Unpaid',
  
  -- Dates
  sale_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date DESC);

-- ============================================================================
-- TABLE 17: USER SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- ============================================================================
-- TABLE 18: AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ============================================================================
-- TABLE 19: ASSETS (Physical/Financial Assets)
-- ============================================================================

CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  
  -- Identity
  name VARCHAR(255) NOT NULL,
  description TEXT,
  asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('laptop', 'phone', 'equipment', 'furniture', 'vehicle', 'property', 'other')),
  
  -- Financial
  acquisition_cost DECIMAL(15, 2) NOT NULL,
  acquisition_date DATE NOT NULL,
  depreciation_rate DECIMAL(5, 2) DEFAULT 0,
  accumulated_depreciation DECIMAL(15, 2) DEFAULT 0,
  residual_value DECIMAL(15, 2) DEFAULT 0,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'disposed', 'lost', 'transferred')),
  location VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);

-- ============================================================================
-- TABLE 20: LIABILITIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  liability_type VARCHAR(50) NOT NULL CHECK (liability_type IN ('loan', 'credit', 'debt', 'payable', 'other')),
  
  -- Financial
  principal_amount DECIMAL(15, 2) NOT NULL,
  interest_rate DECIMAL(5, 2) DEFAULT 0,
  current_balance DECIMAL(15, 2) NOT NULL,
  
  -- Terms
  start_date DATE,
  due_date DATE,
  payment_frequency VARCHAR(50),
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paid', 'defaulted', 'restructured')),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_liabilities_status ON liabilities(status);
CREATE INDEX IF NOT EXISTS idx_liabilities_due ON liabilities(due_date);

-- ============================================================================
-- TABLE 21: INFRASTRUCTURE
-- ============================================================================

CREATE TABLE IF NOT EXISTS infrastructure (
  id SERIAL PRIMARY KEY,
  
  -- Identity
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  infra_type VARCHAR(50) NOT NULL CHECK (infra_type IN ('server', 'domain', 'hosting', 'database', 'api', 'storage', 'other')),
  
  -- Provider
  provider VARCHAR(255),
  provider_url VARCHAR(500),
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  
  -- Costs
  monthly_cost DECIMAL(15, 2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_infrastructure_type ON infrastructure(infra_type);
CREATE INDEX IF NOT EXISTS idx_infrastructure_status ON infrastructure(status);

-- ============================================================================
-- TABLE 22: STAFF
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Identity
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  
  -- Employment
  position VARCHAR(100),
  department VARCHAR(100),
  hire_date DATE DEFAULT CURRENT_DATE,
  salary DECIMAL(15, 2),
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
CREATE INDEX IF NOT EXISTS idx_staff_user ON staff(user_id);

-- ============================================================================
-- VIEW: Financial Dashboard Summary
-- ============================================================================

DROP VIEW IF EXISTS v_financial_summary;
CREATE VIEW v_financial_summary AS
WITH 
  revenue_data AS (
    SELECT 
      COALESCE(SUM(p.amount_received), 0) as total_revenue,
      COUNT(DISTINCT p.id) as payment_count
    FROM payments p
  ),
  expense_data AS (
    SELECT 
      COALESCE(SUM(e.amount), 0) as total_expenses,
      COUNT(e.id) as expense_count
    FROM expenses e
    WHERE e.status = 'recorded'
  ),
  contract_data AS (
    SELECT 
      COUNT(*) as active_contracts,
      COALESCE(SUM(installation_fee), 0) as total_contract_value
    FROM contracts
    WHERE status = 'active'
  ),
  pipeline_data AS (
    SELECT 
      COUNT(*) as open_deals,
      COALESCE(SUM(value_estimate), 0) as pipeline_value,
      COALESCE(SUM(value_estimate * probability / 100), 0) as weighted_pipeline
    FROM deals
    WHERE stage NOT IN ('Won', 'Lost') AND deleted_at IS NULL
  )
SELECT
  r.total_revenue,
  r.payment_count,
  e.total_expenses,
  e.expense_count,
  (r.total_revenue - e.total_expenses) as net_profit,
  c.active_contracts,
  c.total_contract_value,
  p.open_deals,
  p.pipeline_value,
  p.weighted_pipeline
FROM revenue_data r, expense_data e, contract_data c, pipeline_data p;

-- ============================================================================
-- TRIGGER: Auto-update allocation status on payments
-- ============================================================================

CREATE OR REPLACE FUNCTION update_payment_allocation_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE payments
  SET 
    allocated_amount = (SELECT COALESCE(SUM(amount), 0) FROM allocations WHERE payment_id = NEW.payment_id),
    allocation_status = CASE
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM allocations WHERE payment_id = NEW.payment_id) = 0 THEN 'pending'
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM allocations WHERE payment_id = NEW.payment_id) < amount_received THEN 'partial'
      ELSE 'allocated'
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.payment_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_allocation ON allocations;
CREATE TRIGGER trigger_update_payment_allocation
AFTER INSERT OR UPDATE OR DELETE ON allocations
FOR EACH ROW
EXECUTE FUNCTION update_payment_allocation_status();

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp trigger to main tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'users', 'prospects', 'prospect_activities', 'clients', 
    'deals', 'contracts', 'payments', 'expenses', 
    'assets', 'liabilities', 'infrastructure', 'staff',
    'invoices', 'sales'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_update_timestamp ON %I', tbl);
    EXECUTE format('CREATE TRIGGER trigger_update_timestamp BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_timestamp()', tbl);
  END LOOP;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Some tables do not exist yet, skipping triggers';
END $$;

-- ============================================================================
-- COMPLETE
-- ============================================================================

-- Verification query (can be run separately)
-- SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
