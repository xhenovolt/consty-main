-- =============================================================================
-- Migration 940: Strict RBAC — Data Scope, Dashboard Configs, Session Devices
-- Date: 2026-03-19
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Data scope on roles
--    OWN       → user can only see records they created
--    DEPARTMENT → user can see records from their department
--    GLOBAL    → user can see all records (default for backward compat)
-- -----------------------------------------------------------------------------
ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS data_scope VARCHAR(20)
    NOT NULL DEFAULT 'GLOBAL'
    CHECK (data_scope IN ('OWN', 'DEPARTMENT', 'GLOBAL'));

-- Restrictive defaults: demote non-admin roles to OWN scope
UPDATE roles
SET data_scope = 'OWN'
WHERE name NOT IN ('superadmin','admin','founder','ceo','cto','coo','manager','director')
  AND is_system = false
  AND data_scope = 'GLOBAL';

-- Mid-level managers get DEPARTMENT scope
UPDATE roles
SET data_scope = 'DEPARTMENT'
WHERE name IN ('manager','director','team_lead','department_head')
  AND data_scope = 'GLOBAL';

-- -----------------------------------------------------------------------------
-- 2. Role-based dashboard configurations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dashboard_configs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id     UUID REFERENCES roles(id) ON DELETE CASCADE,
  role_name   VARCHAR(100) NOT NULL,
  widgets     JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_configs_role_id ON dashboard_configs(role_id);

-- Seed default dashboard configs per role family
-- Sales role family
INSERT INTO dashboard_configs (role_id, role_name, widgets)
SELECT r.id, r.name,
  '[
    {"id":"pipeline_summary","label":"Pipeline","module":"pipeline","permission":"pipeline.view","size":"medium"},
    {"id":"recent_deals","label":"Recent Deals","module":"deals","permission":"deals.view","size":"medium"},
    {"id":"upcoming_followups","label":"Follow-ups","module":"prospects","permission":"prospects.view","size":"small"},
    {"id":"my_prospects","label":"My Prospects","module":"prospects","permission":"prospects.view","size":"small"},
    {"id":"commission_summary","label":"Commissions","module":"deals","permission":"deals.view","size":"small"}
  ]'::jsonb
FROM roles r
WHERE r.name IN ('sales','sales_rep','business_development','account_manager')
ON CONFLICT (role_id) DO NOTHING;

-- Finance role family
INSERT INTO dashboard_configs (role_id, role_name, widgets)
SELECT r.id, r.name,
  '[
    {"id":"financial_summary","label":"Financial Overview","module":"finance","permission":"finance.view","size":"large"},
    {"id":"account_balances","label":"Accounts","module":"finance","permission":"accounts.view","size":"medium"},
    {"id":"recent_expenses","label":"Expenses","module":"finance","permission":"expenses.view","size":"medium"},
    {"id":"budget_status","label":"Budgets","module":"finance","permission":"budgets.view","size":"medium"},
    {"id":"payment_summary","label":"Payments","module":"finance","permission":"payments.view","size":"small"}
  ]'::jsonb
FROM roles r
WHERE r.name IN ('finance','accountant','finance_manager','cfo')
ON CONFLICT (role_id) DO NOTHING;

-- Developer/Engineering role family
INSERT INTO dashboard_configs (role_id, role_name, widgets)
SELECT r.id, r.name,
  '[
    {"id":"systems_overview","label":"Systems","module":"systems","permission":"systems.view","size":"large"},
    {"id":"bug_tracker","label":"Bugs & Issues","module":"systems","permission":"bug_tracking.view","size":"medium"},
    {"id":"operations_log","label":"Operations","module":"systems","permission":"operations.view","size":"medium"},
    {"id":"deployment_status","label":"Deployments","module":"systems","permission":"systems.view","size":"small"}
  ]'::jsonb
FROM roles r
WHERE r.name IN ('developer','engineer','tech','cto','software_engineer')
ON CONFLICT (role_id) DO NOTHING;

-- Admin / Superadmin gets full founder dashboard (all widgets)
INSERT INTO dashboard_configs (role_id, role_name, widgets)
SELECT r.id, r.name,
  '[
    {"id":"pipeline_summary","label":"Pipeline","module":"pipeline","permission":"pipeline.view","size":"medium"},
    {"id":"deal_summary","label":"Deals","module":"deals","permission":"deals.view","size":"medium"},
    {"id":"financial_summary","label":"Financials","module":"finance","permission":"finance.view","size":"large"},
    {"id":"account_balances","label":"Accounts","module":"finance","permission":"accounts.view","size":"medium"},
    {"id":"upcoming_followups","label":"Follow-ups","module":"prospects","permission":"prospects.view","size":"small"},
    {"id":"operations","label":"Operations","module":"systems","permission":"operations.view","size":"small"},
    {"id":"attention_items","label":"Attention Items","module":"dashboard","permission":"dashboard.view","size":"medium"},
    {"id":"recent_activity","label":"Activity","module":"activity_logs","permission":"activity_logs.view","size":"small"},
    {"id":"monthly_financials","label":"Monthly P&L","module":"finance","permission":"finance.view","size":"large"}
  ]'::jsonb
FROM roles r
WHERE r.name IN ('superadmin','admin','founder','ceo','coo')
ON CONFLICT (role_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Device / IP tracking on sessions
-- -----------------------------------------------------------------------------
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS device_name  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS ip_address   VARCHAR(45),
  ADD COLUMN IF NOT EXISTS user_agent   TEXT,
  ADD COLUMN IF NOT EXISTS is_revoked   BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sessions_user_active
  ON sessions(user_id, expires_at)
  WHERE is_revoked = false;

-- -----------------------------------------------------------------------------
-- 4. Populate route_path on existing permissions (where missing)
--    Maps canonical module.action → the primary app route it governs
-- -----------------------------------------------------------------------------
UPDATE permissions SET route_path = '/app/dashboard'        WHERE module = 'dashboard'      AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/pipeline'         WHERE module = 'pipeline'       AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/prospects'        WHERE module = 'prospects'      AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/deals'            WHERE module = 'deals'          AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/finance'          WHERE module = 'finance'        AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/finance/accounts' WHERE module = 'accounts'       AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/finance/expenses' WHERE module = 'expenses'       AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/finance/budgets'  WHERE module = 'budgets'        AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/payments'         WHERE module = 'payments'       AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/invoices'         WHERE module = 'invoices'       AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/staff'            WHERE module = 'staff'          AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/clients'          WHERE module = 'clients'        AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/admin/users'      WHERE module = 'users'          AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/admin/roles'      WHERE module = 'roles'          AND action = 'manage' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/systems'          WHERE module = 'systems'        AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/reports'          WHERE module = 'reports'        AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/activity'         WHERE module = 'activity_logs'  AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/intelligence'     WHERE module = 'intelligence'   AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/knowledge'        WHERE module = 'knowledge'      AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/media'            WHERE module = 'media'          AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/admin/audit-logs' WHERE module = 'audit'          AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/hrm'              WHERE module = 'hrm'            AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/documents'        WHERE module = 'documents'      AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/allocations'      WHERE module = 'allocations'    AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/operations'       WHERE module = 'operations'     AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/licenses'         WHERE module = 'licenses'       AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/services'         WHERE module = 'services'       AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/products'         WHERE module = 'products'       AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/obligations'      WHERE module = 'obligations'    AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/offerings'        WHERE module = 'offerings'      AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/admin/departments' WHERE module = 'departments'   AND action = 'view' AND route_path IS NULL;
UPDATE permissions SET route_path = '/app/admin/backups'     WHERE module = 'backups'       AND action = 'view' AND route_path IS NULL;

-- -----------------------------------------------------------------------------
-- 5. Inactivity timeout tracking (for session security hardening)
-- -----------------------------------------------------------------------------
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS inactivity_timeout_minutes INTEGER NOT NULL DEFAULT 60;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS absolute_expiry TIMESTAMPTZ;
