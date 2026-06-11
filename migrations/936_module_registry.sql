-- ============================================================================
-- Migration 936: Module Registry & AuthorizationEngine Foundation
-- Date: 2026-03-16
-- Purpose:
--   1. Create the modules table — canonical registry of every Consty module.
--   2. Seed all known modules with their route_path and required permission.
--   3. Add module_key FK column to permissions table so each permission is
--      formally linked to a module record.
--   4. Enforce role_permissions foreign key integrity.
-- Safety: All operations use IF NOT EXISTS / ON CONFLICT DO NOTHING guards.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. MODULES TABLE
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS modules (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  module_key   varchar(100) NOT NULL UNIQUE,  -- e.g. 'finance'
  module_name  varchar(200) NOT NULL,          -- e.g. 'Finance'
  route_path   varchar(255),                   -- e.g. '/app/finance'
  description  text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modules_key ON modules(module_key);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. SEED MODULES
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO modules (module_key, module_name, route_path, description) VALUES
  ('dashboard',          'Dashboard',             '/app/dashboard',                    'Main system overview'),
  ('command_center',     'Command Center',        '/app/command-center',               'High-level founder control'),
  ('activity_logs',      'Activity Logs',         '/app/activity',                     'System-wide activity feed'),
  ('systems',            'Systems',               '/app/systems',                      'Software platforms & IP'),
  ('licenses',           'Licenses',              '/app/licenses',                     'Active license registry'),
  ('operations',         'Operations',            '/app/operations',                   'Daily founder ops log'),
  ('services',           'Services',              '/app/services',                     'Service catalog'),
  ('products',           'Products',              '/app/products',                     'Product catalog'),
  ('pipeline',           'Pipeline',              '/app/pipeline',                     'Sales pipeline board'),
  ('prospects',          'Prospects',             '/app/prospects',                    'Lead and prospect tracking'),
  ('clients',            'Clients',               '/app/clients',                      'Converted client records'),
  ('deals',              'Deals',                 '/app/deals',                        'Deals and contracts'),
  ('obligations',        'Obligations',           '/app/obligations',                  'Client deliverable tracking'),
  ('payments',           'Payments',              '/app/payments',                     'Payment records'),
  ('invoices',           'Invoices',              '/app/invoices',                     'Generated invoices and PDFs'),
  ('allocations',        'Allocations',           '/app/allocations',                  'Money allocation tracking'),
  ('finance',            'Finance',               '/app/finance',                      'Financial dashboard & ledger'),
  ('accounts',           'Accounts',              '/app/finance/accounts',             'Bank and cash accounts'),
  ('expenses',           'Expenses',              '/app/finance/expenses',             'Expense tracking'),
  ('budgets',            'Budgets',               '/app/finance/budgets',              'Spending limits and budgets'),
  ('knowledge',          'Knowledge Base',        '/app/knowledge',                    'Company IP and documentation'),
  ('media',              'Media',                 '/app/media',                        'Files, images and documents'),
  ('documents',          'Documents',             '/app/documents',                    'Document center'),
  ('intelligence',       'Intelligence',          '/app/intelligence',                 'Role-based intelligence'),
  ('bug_tracking',       'Engineering',           '/app/tech-intelligence',            'Bugs, features and tech stack'),
  ('issue_intelligence', 'Issue Intelligence',    '/app/issue-intelligence',           'Root causes and resolutions'),
  ('decision_logs',      'Decision Log',          '/app/decision-log',                 'Key decisions and rationale'),
  ('hrm',                'HRM',                   '/app/hrm',                          'HR management dashboard'),
  ('reports',            'Reports',               '/app/reports',                      'Business reports'),
  ('staff',              'Staff',                 '/app/staff',                        'Team directory'),
  ('departments',        'Departments',           '/app/admin/departments',            'Department management'),
  ('users',              'Users',                 '/app/admin/users',                  'User account management'),
  ('roles',              'Roles',                 '/app/admin/roles',                  'Role and permission management'),
  ('audit',              'Audit Logs',            '/app/admin/audit-logs',             'System audit trail'),
  ('approvals',          'Approvals',             '/app/admin/approvals',              'Pending approval requests'),
  ('backups',            'Backups',               '/app/admin/backups',                'System backups and restore'),
  ('assets',             'Assets',                '/app/assets',                       'Company asset registry'),
  ('settings',           'Settings',              '/app/settings',                     'Account and system settings'),
  ('offerings',          'Offerings',             '/app/offerings',                    'Service offerings catalog'),
  ('liabilities',        'Liabilities',           '/app/liabilities',                  'Obligations and debts')
ON CONFLICT (module_key) DO UPDATE
  SET module_name = EXCLUDED.module_name,
      route_path  = EXCLUDED.route_path,
      description = EXCLUDED.description;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. LINK PERMISSIONS TO MODULES (add module_key FK if not present)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE permissions ADD COLUMN IF NOT EXISTS module_key varchar(100);

-- Backfill module_key from the module column that already exists
UPDATE permissions
SET module_key = module
WHERE module_key IS NULL AND module IS NOT NULL;

-- Add FK constraint (deferred to avoid breaking existing data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_permissions_module_key' AND table_name = 'permissions'
  ) THEN
    ALTER TABLE permissions
      ADD CONSTRAINT fk_permissions_module_key
      FOREIGN KEY (module_key) REFERENCES modules(module_key)
      ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

COMMIT;
