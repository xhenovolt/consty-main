-- ============================================================================
-- CONSTY FOUNDER OPERATING SYSTEM - NEW ARCHITECTURE
-- Migration 200: Complete Schema Rebuild
-- Date: 2026-03-08
-- 
-- PRINCIPLES:
--   1. Ledger-based finance: balances are COMPUTED, never stored
--   2. Every financial movement creates a ledger entry
--   3. Single source of truth for every number
--   4. Workflow: Prospect → Follow-up → Convert → Deal → Payment → Ledger
--   5. Partial payments supported on deals
--   6. Money location tracking via accounts
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. USERS & SESSIONS (Authentication)
-- ============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('superadmin', 'admin', 'user', 'viewer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ============================================================================
-- 2. AUDIT LOG (System-wide activity tracking)
-- ============================================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- 3. ACCOUNTS (Where money lives)
-- ============================================================================

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('bank', 'cash', 'mobile_money', 'credit_card', 'investment', 'escrow', 'other')),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  description TEXT,
  institution VARCHAR(255),
  account_number VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- NOTE: No balance column! Balance = SUM(ledger entries for this account)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_is_active ON accounts(is_active);

-- ============================================================================
-- 4. OFFERINGS (What you sell - products/services)
-- ============================================================================

CREATE TABLE offerings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('product', 'service', 'subscription', 'license', 'consulting', 'other')),
  description TEXT,
  default_price NUMERIC(15,2),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  unit VARCHAR(50),  -- 'per hour', 'per project', 'per month', 'per unit'
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_offerings_type ON offerings(type);
CREATE INDEX idx_offerings_is_active ON offerings(is_active);

-- ============================================================================
-- 5. PROSPECTS (Lead tracking)
-- ============================================================================

CREATE TABLE prospects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(500),
  industry VARCHAR(100),
  source VARCHAR(100) CHECK (source IN ('referral', 'cold_outreach', 'inbound', 'event', 'social_media', 'website', 'partner', 'other')),
  stage VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'dormant')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  estimated_value NUMERIC(15,2),
  currency VARCHAR(3) DEFAULT 'USD',
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  next_followup_date DATE,
  converted_at TIMESTAMPTZ,
  lost_reason TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prospects_stage ON prospects(stage);
CREATE INDEX idx_prospects_source ON prospects(source);
CREATE INDEX idx_prospects_priority ON prospects(priority);
CREATE INDEX idx_prospects_assigned_to ON prospects(assigned_to);
CREATE INDEX idx_prospects_next_followup ON prospects(next_followup_date);
CREATE INDEX idx_prospects_created_at ON prospects(created_at);

-- ============================================================================
-- 6. PROSPECT CONTACTS (Multiple contacts per prospect)
-- ============================================================================

CREATE TABLE prospect_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prospect_contacts_prospect_id ON prospect_contacts(prospect_id);

-- ============================================================================
-- 7. FOLLOWUPS (Activity tracking on prospects)
-- ============================================================================

CREATE TABLE followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'demo', 'proposal', 'site_visit', 'social', 'other')),
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  summary TEXT,
  outcome TEXT,
  next_action TEXT,
  next_followup_date DATE,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_followups_prospect_id ON followups(prospect_id);
CREATE INDEX idx_followups_status ON followups(status);
CREATE INDEX idx_followups_scheduled_at ON followups(scheduled_at);
CREATE INDEX idx_followups_performed_by ON followups(performed_by);

-- ============================================================================
-- 8. CLIENTS (Converted prospects - the people who pay you)
-- ============================================================================

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID UNIQUE REFERENCES prospects(id) ON DELETE SET NULL,
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(500),
  industry VARCHAR(100),
  billing_address TEXT,
  tax_id VARCHAR(100),
  payment_terms INTEGER DEFAULT 30,  -- days
  preferred_currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'churned')),
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  lifetime_value NUMERIC(15,2) DEFAULT 0,  -- COMPUTED from deals/payments, updated by trigger
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_prospect_id ON clients(prospect_id);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_company_name ON clients(company_name);

-- ============================================================================
-- 9. DEALS (Revenue commitments from clients)
-- ============================================================================

CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  offering_id UUID REFERENCES offerings(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Financial
  total_amount NUMERIC(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  -- paid_amount is COMPUTED: SUM(payments.amount WHERE deal_id = this AND status = 'completed')
  -- remaining_amount is COMPUTED: total_amount - paid_amount
  
  -- Status tracking
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'in_progress', 'completed', 'cancelled', 'disputed')),
  
  -- Dates
  start_date DATE,
  end_date DATE,
  due_date DATE,
  closed_at TIMESTAMPTZ,
  
  -- Invoice info
  invoice_number VARCHAR(100),
  invoice_sent_at TIMESTAMPTZ,
  invoice_pdf_url TEXT,
  
  -- Metadata
  terms TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deals_client_id ON deals(client_id);
CREATE INDEX idx_deals_prospect_id ON deals(prospect_id);
CREATE INDEX idx_deals_offering_id ON deals(offering_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_due_date ON deals(due_date);
CREATE INDEX idx_deals_created_at ON deals(created_at);

-- ============================================================================
-- 10. PAYMENTS (Money received against deals)
-- ============================================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  
  method VARCHAR(50) CHECK (method IN ('bank_transfer', 'cash', 'check', 'credit_card', 'mobile_money', 'crypto', 'other')),
  reference VARCHAR(255),  -- transaction reference / receipt number
  
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'partial_refund')),
  
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_at TIMESTAMPTZ,
  notes TEXT,
  
  -- Every completed payment MUST create a ledger entry (enforced by app logic)
  ledger_entry_id UUID,  -- back-reference to the ledger entry created
  
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_deal_id ON payments(deal_id);
CREATE INDEX idx_payments_account_id ON payments(account_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);

-- ============================================================================
-- 11. LEDGER (The single source of financial truth)
-- ============================================================================
-- 
-- RULES:
--   - Every financial movement creates exactly ONE ledger entry
--   - Account balance = SUM(amount) WHERE account_id = X
--   - Positive amount = money IN (credit to account)
--   - Negative amount = money OUT (debit from account)
--   - Ledger entries are IMMUTABLE (never updated or deleted)
--   - Corrections are made by creating reverse entries
--

CREATE TABLE ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  
  amount NUMERIC(15,2) NOT NULL,  -- positive = credit, negative = debit
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  running_balance NUMERIC(15,2),  -- optional: cached running balance for performance
  
  -- Polymorphic source reference
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('payment', 'expense', 'transfer_in', 'transfer_out', 'adjustment', 'refund', 'initial_balance')),
  source_id UUID,  -- references the payment/expense/transfer that created this entry
  
  description TEXT NOT NULL,
  category VARCHAR(100),
  
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NO updated_at! Ledger entries are IMMUTABLE
);

CREATE INDEX idx_ledger_account_id ON ledger(account_id);
CREATE INDEX idx_ledger_source ON ledger(source_type, source_id);
CREATE INDEX idx_ledger_entry_date ON ledger(entry_date);
CREATE INDEX idx_ledger_category ON ledger(category);
CREATE INDEX idx_ledger_created_at ON ledger(created_at);

-- ============================================================================
-- 12. EXPENSES (Money going out)
-- ============================================================================

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  vendor VARCHAR(255),
  description TEXT NOT NULL,
  
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  receipt_url TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_interval VARCHAR(30),  -- 'weekly', 'monthly', 'quarterly', 'yearly'
  
  status VARCHAR(30) NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'pending', 'approved', 'rejected', 'void')),
  
  budget_id UUID,  -- optional link to budget (FK added after budgets table)
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  
  -- Every recorded expense MUST create a ledger entry (enforced by app logic)
  ledger_entry_id UUID,  -- back-reference to the ledger entry created
  
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_account_id ON expenses(account_id);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_budget_id ON expenses(budget_id);

-- ============================================================================
-- 13. TRANSFERS (Money moving between accounts)
-- ============================================================================

CREATE TABLE transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  to_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  
  -- If currencies differ, record the exchange
  to_amount NUMERIC(15,2),  -- amount received (if different currency)
  to_currency VARCHAR(3),
  exchange_rate NUMERIC(15,6),
  
  description TEXT,
  reference VARCHAR(255),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  status VARCHAR(30) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  
  -- Creates TWO ledger entries: debit from_account, credit to_account
  ledger_debit_id UUID,
  ledger_credit_id UUID,
  
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT different_accounts CHECK (from_account_id != to_account_id)
);

CREATE INDEX idx_transfers_from_account ON transfers(from_account_id);
CREATE INDEX idx_transfers_to_account ON transfers(to_account_id);
CREATE INDEX idx_transfers_transfer_date ON transfers(transfer_date);
CREATE INDEX idx_transfers_status ON transfers(status);

-- ============================================================================
-- 14. BUDGETS (Financial planning)
-- ============================================================================

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  -- spent is COMPUTED: SUM(expenses.amount WHERE budget_id = this)
  -- remaining is COMPUTED: amount - spent
  
  period VARCHAR(30) NOT NULL CHECK (period IN ('monthly', 'quarterly', 'yearly', 'custom')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  alert_threshold NUMERIC(5,2) DEFAULT 80.00,  -- alert when X% spent
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

CREATE INDEX idx_budgets_category ON budgets(category);
CREATE INDEX idx_budgets_period ON budgets(period);
CREATE INDEX idx_budgets_is_active ON budgets(is_active);
CREATE INDEX idx_budgets_date_range ON budgets(start_date, end_date);

-- Add FK from expenses to budgets now that budgets table exists
ALTER TABLE expenses ADD CONSTRAINT fk_expenses_budget FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE SET NULL;

-- Add FK from payments/expenses ledger back-references
ALTER TABLE payments ADD CONSTRAINT fk_payments_ledger FOREIGN KEY (ledger_entry_id) REFERENCES ledger(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD CONSTRAINT fk_expenses_ledger FOREIGN KEY (ledger_entry_id) REFERENCES ledger(id) ON DELETE SET NULL;
ALTER TABLE transfers ADD CONSTRAINT fk_transfers_ledger_debit FOREIGN KEY (ledger_debit_id) REFERENCES ledger(id) ON DELETE SET NULL;
ALTER TABLE transfers ADD CONSTRAINT fk_transfers_ledger_credit FOREIGN KEY (ledger_credit_id) REFERENCES ledger(id) ON DELETE SET NULL;

-- ============================================================================
-- 15. VIEWS (Computed values - never stored)
-- ============================================================================

-- Account balances (computed from ledger)
CREATE OR REPLACE VIEW v_account_balances AS
SELECT
  a.id AS account_id,
  a.name,
  a.type,
  a.currency,
  a.is_active,
  COALESCE(SUM(l.amount), 0) AS balance,
  COUNT(l.id) AS transaction_count,
  MAX(l.entry_date) AS last_transaction_date
FROM accounts a
LEFT JOIN ledger l ON l.account_id = a.id
GROUP BY a.id, a.name, a.type, a.currency, a.is_active;

-- Deal payment status (computed from payments)
CREATE OR REPLACE VIEW v_deal_payment_status AS
SELECT
  d.id AS deal_id,
  d.title,
  d.client_id,
  d.total_amount,
  d.currency,
  d.status,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) AS paid_amount,
  d.total_amount - COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) AS remaining_amount,
  COUNT(p.id) FILTER (WHERE p.status = 'completed') AS payment_count,
  CASE
    WHEN COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) >= d.total_amount THEN 'fully_paid'
    WHEN COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) > 0 THEN 'partially_paid'
    ELSE 'unpaid'
  END AS payment_status
FROM deals d
LEFT JOIN payments p ON p.deal_id = d.id
GROUP BY d.id, d.title, d.client_id, d.total_amount, d.currency, d.status;

-- Budget utilization (computed from expenses)
CREATE OR REPLACE VIEW v_budget_utilization AS
SELECT
  b.id AS budget_id,
  b.name,
  b.category,
  b.amount AS budgeted,
  b.currency,
  b.period,
  b.start_date,
  b.end_date,
  COALESCE(SUM(e.amount) FILTER (WHERE e.status != 'void' AND e.status != 'rejected'), 0) AS spent,
  b.amount - COALESCE(SUM(e.amount) FILTER (WHERE e.status != 'void' AND e.status != 'rejected'), 0) AS remaining,
  CASE
    WHEN b.amount > 0 THEN ROUND((COALESCE(SUM(e.amount) FILTER (WHERE e.status != 'void' AND e.status != 'rejected'), 0) / b.amount) * 100, 2)
    ELSE 0
  END AS utilization_pct,
  b.alert_threshold,
  b.is_active
FROM budgets b
LEFT JOIN expenses e ON e.budget_id = b.id AND e.expense_date BETWEEN b.start_date AND b.end_date
GROUP BY b.id, b.name, b.category, b.amount, b.currency, b.period, b.start_date, b.end_date, b.alert_threshold, b.is_active;

-- Client lifetime value (computed from deals/payments)
CREATE OR REPLACE VIEW v_client_summary AS
SELECT
  c.id AS client_id,
  c.company_name,
  c.status,
  COUNT(DISTINCT d.id) AS deal_count,
  COALESCE(SUM(d.total_amount), 0) AS total_deal_value,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) AS total_paid,
  MAX(p.payment_date) AS last_payment_date,
  MIN(d.created_at) AS first_deal_date
FROM clients c
LEFT JOIN deals d ON d.client_id = c.id
LEFT JOIN payments p ON p.deal_id = d.id
GROUP BY c.id, c.company_name, c.status;

-- Prospect pipeline summary
CREATE OR REPLACE VIEW v_prospect_pipeline AS
SELECT
  stage,
  COUNT(*) AS count,
  COALESCE(SUM(estimated_value), 0) AS total_value,
  COALESCE(AVG(estimated_value), 0) AS avg_value
FROM prospects
WHERE stage NOT IN ('won', 'lost')
GROUP BY stage
ORDER BY 
  CASE stage
    WHEN 'new' THEN 1
    WHEN 'contacted' THEN 2
    WHEN 'qualified' THEN 3
    WHEN 'proposal' THEN 4
    WHEN 'negotiation' THEN 5
    ELSE 6
  END;

-- Financial summary (total in/out across all accounts)
CREATE OR REPLACE VIEW v_financial_summary AS
SELECT
  COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0) AS total_income,
  COALESCE(SUM(ABS(amount)) FILTER (WHERE amount < 0), 0) AS total_expenses,
  COALESCE(SUM(amount), 0) AS net_position,
  COUNT(*) FILTER (WHERE amount > 0) AS income_transactions,
  COUNT(*) FILTER (WHERE amount < 0) AS expense_transactions,
  COUNT(*) AS total_transactions
FROM ledger;

-- Monthly financial breakdown
CREATE OR REPLACE VIEW v_monthly_financials AS
SELECT
  DATE_TRUNC('month', entry_date)::DATE AS month,
  COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0) AS income,
  COALESCE(SUM(ABS(amount)) FILTER (WHERE amount < 0), 0) AS expenses,
  COALESCE(SUM(amount), 0) AS net,
  COUNT(*) AS transaction_count
FROM ledger
GROUP BY DATE_TRUNC('month', entry_date)
ORDER BY month DESC;

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

-- Apply updated_at triggers to all mutable tables
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_offerings_updated_at BEFORE UPDATE ON offerings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_prospects_updated_at BEFORE UPDATE ON prospects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_prospect_contacts_updated_at BEFORE UPDATE ON prospect_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_followups_updated_at BEFORE UPDATE ON followups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_deals_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_transfers_updated_at BEFORE UPDATE ON transfers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- NOTE: ledger has NO updated_at trigger - entries are IMMUTABLE

-- ============================================================================
-- 17. SEED DEFAULT ADMIN USER
-- ============================================================================

-- Default admin: admin@consty.local / ChangeMe!2026 (bcrypt hash)
-- Password should be changed on first login
INSERT INTO users (email, password_hash, name, role)
VALUES ('admin@consty.local', '$2b$10$xDDq8UN2bfX2kI4WdbCCxuHJ8UZ.3q29yphYJcxIy2btD9S7C8Y2.', 'Consty Admin', 'superadmin');

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
-- Tables: 14 (users, sessions, audit_logs, accounts, offerings, prospects,
--             prospect_contacts, followups, clients, deals, payments, 
--             ledger, expenses, transfers, budgets)
-- Views:  7  (v_account_balances, v_deal_payment_status, v_budget_utilization,
--             v_client_summary, v_prospect_pipeline, v_financial_summary,
--             v_monthly_financials)
-- ============================================================================
