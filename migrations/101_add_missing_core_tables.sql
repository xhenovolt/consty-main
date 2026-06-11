/**
 * Consty Migration 101: Add Missing Core Tables
 * 
 * Creates the missing tables for the founder workflow:
 * - clients (converted prospects)
 * - contracts (won deals become contracts)
 * - payments (money received)
 * - allocations (money distribution)
 * - expenses (tracking expenses)
 * - expense_categories
 * - staff
 *
 * Also adds missing columns to deals table for proper foreign keys.
 */

-- ============================================================================
-- TABLE 1: CLIENTS (Converted Prospects)
-- ============================================================================

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to prospect (required for conversion flow)
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  
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
-- TABLE 2: EXPENSE CATEGORIES
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
-- TABLE 3: CONTRACTS (Won Deals become Contracts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Required Relationships
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  system_id UUID REFERENCES intellectual_property(id) ON DELETE RESTRICT,
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
-- TABLE 4: PAYMENTS (Money Received)
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
-- TABLE 5: ALLOCATIONS (Where Money Goes)
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
-- TABLE 6: EXPENSES (Standalone Expense Records)
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
-- TABLE 7: VAULT BALANCES (Money Storage)
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
-- TABLE 8: STAFF
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
-- ADD MISSING COLUMNS TO DEALS TABLE
-- ============================================================================

-- Add client_id column if it doesn't exist
ALTER TABLE deals ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_client ON deals(client_id);

-- Add system_id column referencing intellectual_property (UUID type)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS system_id UUID REFERENCES intellectual_property(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_system ON deals(system_id);

-- ============================================================================
-- TRIGGER: Auto-update allocation status on payments
-- ============================================================================

CREATE OR REPLACE FUNCTION update_payment_allocation_status()
RETURNS TRIGGER AS $$
DECLARE
  p_id UUID;
  total_allocated DECIMAL(15,2);
  p_amount DECIMAL(15,2);
BEGIN
  -- Get the payment ID (handle both INSERT/UPDATE and DELETE)
  p_id := COALESCE(NEW.payment_id, OLD.payment_id);
  
  -- Calculate total allocated
  SELECT COALESCE(SUM(amount), 0) INTO total_allocated
  FROM allocations WHERE payment_id = p_id;
  
  -- Get payment amount
  SELECT amount_received INTO p_amount FROM payments WHERE id = p_id;
  
  -- Update payment allocation status
  UPDATE payments
  SET 
    allocated_amount = total_allocated,
    allocation_status = CASE
      WHEN total_allocated = 0 THEN 'pending'
      WHEN total_allocated < p_amount THEN 'partial'
      ELSE 'allocated'
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_allocation ON allocations;
CREATE TRIGGER trigger_update_payment_allocation
AFTER INSERT OR UPDATE OR DELETE ON allocations
FOR EACH ROW
EXECUTE FUNCTION update_payment_allocation_status();

-- ============================================================================
-- CONSTRAINT: Ensure allocation doesn't exceed payment
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_allocation_amount()
RETURNS TRIGGER AS $$
DECLARE
  p_amount DECIMAL(15,2);
  total_allocated DECIMAL(15,2);
  new_total DECIMAL(15,2);
BEGIN
  -- Get payment amount
  SELECT amount_received INTO p_amount FROM payments WHERE id = NEW.payment_id;
  
  -- Get current total allocated (excluding this allocation if UPDATE)
  SELECT COALESCE(SUM(amount), 0) INTO total_allocated
  FROM allocations 
  WHERE payment_id = NEW.payment_id AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  -- Calculate new total
  new_total := total_allocated + NEW.amount;
  
  -- Validate
  IF new_total > p_amount THEN
    RAISE EXCEPTION 'Allocation would exceed payment amount. Payment: %, Current allocated: %, New allocation: %, Total would be: %',
      p_amount, total_allocated, NEW.amount, new_total;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_allocation ON allocations;
CREATE TRIGGER trigger_validate_allocation
BEFORE INSERT OR UPDATE ON allocations
FOR EACH ROW
EXECUTE FUNCTION validate_allocation_amount();

-- ============================================================================
-- VIEW: Financial Dashboard Summary
-- ============================================================================

DROP VIEW IF EXISTS v_financial_summary CASCADE;
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
      COALESCE(SUM(value_estimate::numeric), 0) as pipeline_value
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
  p.pipeline_value
FROM revenue_data r, expense_data e, contract_data c, pipeline_data p;

-- ============================================================================
-- VIEW: Revenue by System (IP)
-- ============================================================================

DROP VIEW IF EXISTS v_revenue_by_system CASCADE;
CREATE VIEW v_revenue_by_system AS
SELECT
  ip.id as system_id,
  ip.name as system_name,
  COUNT(DISTINCT c.id) as contract_count,
  COUNT(DISTINCT c.client_id) as client_count,
  COALESCE(SUM(p.amount_received), 0) as total_revenue,
  COALESCE(SUM(CASE WHEN p.date_received >= date_trunc('month', CURRENT_DATE) THEN p.amount_received ELSE 0 END), 0) as monthly_revenue
FROM intellectual_property ip
LEFT JOIN contracts c ON c.system_id = ip.id
LEFT JOIN payments p ON p.contract_id = c.id
GROUP BY ip.id, ip.name
ORDER BY total_revenue DESC;

-- ============================================================================
-- COMPLETE
-- ============================================================================
