-- Migration 030: Financial Architecture Redesign - Contracts Layer
-- Creates the foundational contract management system for precise revenue tracking

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  business_name VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'churned')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_clients_status ON clients(status);

-- ============================================================================
-- CONTRACTS - Business Model Foundation
-- Every revenue event must be tied to a contract with explicit system selection
-- ============================================================================

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Required relationships
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  system_id INTEGER NOT NULL REFERENCES intellectual_property(id) ON DELETE RESTRICT,
  
  -- Installation Revenue
  installation_fee DECIMAL(19, 2) NOT NULL DEFAULT 0 CHECK (installation_fee >= 0),
  installation_date DATE,
  
  -- Recurring Revenue Configuration
  recurring_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_cycle VARCHAR(50) CHECK (
    (recurring_enabled = false AND recurring_cycle IS NULL) OR
    (recurring_enabled = true AND recurring_cycle IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual'))
  ),
  recurring_amount DECIMAL(19, 2) CHECK (
    (recurring_enabled = false AND recurring_amount IS NULL) OR
    (recurring_enabled = true AND recurring_amount > 0)
  ),
  
  -- Lifecycle
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'suspended')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  
  -- Metadata
  terms TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT recurring_validation CHECK (
    (recurring_enabled = false) OR
    (recurring_enabled = true AND recurring_cycle IS NOT NULL AND recurring_amount > 0)
  ),
  CONSTRAINT end_date_after_start CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_contracts_client_id ON contracts(client_id);
CREATE INDEX idx_contracts_system_id ON contracts(system_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_recurring_enabled ON contracts(recurring_enabled);
CREATE INDEX idx_contracts_created_at ON contracts(created_at);

-- ============================================================================
-- PAYMENTS - Money Received
-- Immutable record of cash inflow tied to specific contracts
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Required relationship
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  
  -- Amount received
  amount_received DECIMAL(19, 2) NOT NULL CHECK (amount_received > 0),
  date_received DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Payment details
  payment_method VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (payment_method IN (
    'cash', 'bank_transfer', 'mobile_money', 'check', 'credit_card', 'crypto', 'other'
  )),
  reference_number VARCHAR(255),
  
  -- Allocation status
  allocation_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (allocation_status IN ('pending', 'allocated', 'disputed')),
  allocated_amount DECIMAL(19, 2) NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT allocation_not_exceeds_amount CHECK (allocated_amount <= amount_received)
);

CREATE INDEX idx_payments_contract_id ON payments(contract_id);
CREATE INDEX idx_payments_date_received ON payments(date_received);
CREATE INDEX idx_payments_allocation_status ON payments(allocation_status);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- ============================================================================
-- EXPENSE_CATEGORIES - System Defined + User Created
-- Rigid categorization to ensure consistent expense tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Type
  is_system_defined BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Creation tracking
  created_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expense_categories_system_defined ON expense_categories(is_system_defined);
CREATE INDEX idx_expense_categories_name ON expense_categories(name);

-- ============================================================================
-- ALLOCATIONS - Where Money Goes
-- Mandatory: All received money must be allocated across operating, vault, expenses, investment, or custom
-- ============================================================================

CREATE TABLE IF NOT EXISTS allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Required relationship to payment
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  
  -- Allocation type
  allocation_type VARCHAR(50) NOT NULL CHECK (allocation_type IN (
    'operating', 'vault', 'expense', 'investment', 'custom'
  )),
  
  -- Category (for custom allocations or expense tracking)
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  custom_category VARCHAR(255),
  
  -- Amount being allocated
  amount DECIMAL(19, 2) NOT NULL CHECK (amount > 0),
  
  -- Description of allocation
  description TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_allocations_payment_id ON allocations(payment_id);
CREATE INDEX idx_allocations_allocation_type ON allocations(allocation_type);
CREATE INDEX idx_allocations_category_id ON allocations(category_id);
CREATE INDEX idx_allocations_created_at ON allocations(created_at);

-- ============================================================================
-- EXPENSES - What We Spend
-- Can be linked to allocations (mandatory) or standalone (less preferable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Required
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  amount DECIMAL(19, 2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Optional linking to payment allocation
  linked_allocation_id UUID REFERENCES allocations(id) ON DELETE SET NULL,
  
  -- Details
  description TEXT,
  payment_method VARCHAR(50),
  reference_number VARCHAR(255),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expenses_category_id ON expenses(category_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_expenses_linked_allocation_id ON expenses(linked_allocation_id);
CREATE INDEX idx_expenses_created_at ON expenses(created_at);

-- ============================================================================
-- MONEY FLOW AUDIT VIEW
-- Query to detect orphaned money, misallocations, and track complete payment journey
-- ============================================================================

CREATE OR REPLACE VIEW payment_allocation_audit AS
SELECT
  p.id as payment_id,
  c.id as contract_id,
  c.client_id,
  ip.name as system_name,
  p.amount_received,
  p.allocated_amount,
  (p.amount_received - p.allocated_amount) as unallocated_amount,
  CASE 
    WHEN p.amount_received - p.allocated_amount > 0.01 THEN 'UNALLOCATED'
    WHEN p.amount_received - p.allocated_amount < -0.01 THEN 'OVERALLOCATED'
    ELSE 'BALANCED'
  END as allocation_status,
  p.allocation_status,
  p.date_received,
  p.created_at,
  json_agg(json_build_object(
    'allocation_id', a.id,
    'type', a.allocation_type,
    'category', COALESCE(a.custom_category, ec.name),
    'amount', a.amount
  )) as allocations
FROM payments p
JOIN contracts c ON p.contract_id = c.id
JOIN intellectual_property ip ON c.system_id = ip.id
LEFT JOIN allocations a ON p.id = a.payment_id
LEFT JOIN expense_categories ec ON a.category_id = ec.id
GROUP BY p.id, c.id, c.client_id, ip.name, p.amount_received, p.allocated_amount, p.allocation_status, p.date_received, p.created_at;

-- ============================================================================
-- TRIGGER: Update Payment Allocation Status
-- Automatically updates payment.allocation_status based on allocations total
-- ============================================================================

CREATE OR REPLACE FUNCTION update_payment_allocation_status()
RETURNS TRIGGER AS $$
DECLARE
  total_allocated DECIMAL(19, 2);
  payment_amount DECIMAL(19, 2);
BEGIN
  -- Get total allocated for this payment
  SELECT COALESCE(SUM(amount), 0)
  INTO total_allocated
  FROM allocations
  WHERE payment_id = NEW.payment_id;
  
  -- Get payment amount
  SELECT amount_received
  INTO payment_amount
  FROM payments
  WHERE id = NEW.payment_id;
  
  -- Update payment allocated_amount and status
  UPDATE payments
  SET
    allocated_amount = total_allocated,
    allocation_status = CASE
      WHEN total_allocated = payment_amount THEN 'allocated'
      WHEN total_allocated > 0 THEN 'pending'
      ELSE 'pending'
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.payment_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_allocation_status
AFTER INSERT OR UPDATE OR DELETE ON allocations
FOR EACH ROW
EXECUTE FUNCTION update_payment_allocation_status();

-- ============================================================================
-- INITIALIZATION: System Expense Categories
-- These categories are mandatory and can be used immediately
-- ============================================================================

INSERT INTO expense_categories (id, name, description, is_system_defined, created_at)
VALUES
  (gen_random_uuid(), 'Hosting', 'Server, cloud infrastructure, domain costs', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Salaries', 'Employee wages and compensation', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Transport', 'Fuel, vehicle maintenance, travel', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Marketing', 'Advertising, promotions, lead generation', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Equipment', 'Computers, office equipment, tools', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Utilities', 'Electricity, water, internet, phone', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Software Licenses', 'Third-party software, subscriptions, tools', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Consulting', 'Professional services, expert advice', true, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
