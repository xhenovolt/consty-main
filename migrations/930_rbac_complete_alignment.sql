-- ============================================================================
-- Migration 930: Complete RBAC Schema Alignment
-- Date: 2026-03-15
-- Purpose: Align roles, permissions, and supporting tables with backend code
-- Safety: All operations use IF NOT EXISTS / IF EXISTS guards
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. ROLES TABLE — Add missing columns
-- ────────────────────────────────────────────────────────────────────────────

-- authority_level: power ranking (CEO=100, Manager=60, Staff=20)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='authority_level') THEN
    ALTER TABLE roles ADD COLUMN authority_level integer DEFAULT 20;
  END IF;
END $$;

-- hierarchy_level: reporting order (1=top, higher=lower)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='hierarchy_level') THEN
    ALTER TABLE roles ADD COLUMN hierarchy_level integer DEFAULT 5;
  END IF;
END $$;

-- alias: display name override
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='alias') THEN
    ALTER TABLE roles ADD COLUMN alias varchar(100);
  END IF;
END $$;

-- is_active: soft-delete support
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='is_active') THEN
    ALTER TABLE roles ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- created_by: who created the role
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='created_by') THEN
    ALTER TABLE roles ADD COLUMN created_by uuid;
  END IF;
END $$;

-- Ensure name is unique
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='roles' AND indexname='roles_name_key') THEN
    ALTER TABLE roles ADD CONSTRAINT roles_name_key UNIQUE (name);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. PERMISSIONS TABLE — Add missing columns
-- ────────────────────────────────────────────────────────────────────────────

-- name: human-readable unique key (e.g. 'create_deal')
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='name') THEN
    ALTER TABLE permissions ADD COLUMN name varchar(100);
    -- Backfill name from module.action for existing rows
    UPDATE permissions SET name = module || '_' || action WHERE name IS NULL;
  END IF;
END $$;

-- route_path: the API or page route this permission guards
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='route_path') THEN
    ALTER TABLE permissions ADD COLUMN route_path varchar(255);
  END IF;
END $$;

-- method: HTTP method (GET, POST, PUT, DELETE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='method') THEN
    ALTER TABLE permissions ADD COLUMN method varchar(10);
  END IF;
END $$;

-- Backfill route_path and method based on module+action conventions
UPDATE permissions SET
  route_path = CASE
    WHEN module = 'deals' AND action = 'create' THEN '/api/deals'
    WHEN module = 'deals' AND action = 'view' THEN '/api/deals'
    WHEN module = 'deals' AND action = 'update' THEN '/api/deals'
    WHEN module = 'deals' AND action = 'delete' THEN '/api/deals'
    WHEN module = 'prospects' AND action = 'create' THEN '/api/prospects'
    WHEN module = 'prospects' AND action = 'view' THEN '/api/prospects'
    WHEN module = 'prospects' AND action = 'update' THEN '/api/prospects'
    WHEN module = 'prospects' AND action = 'delete' THEN '/api/prospects'
    WHEN module = 'finance' AND action IN ('view','create','manage') THEN '/api/finance'
    WHEN module = 'assets' AND action IN ('view','manage') THEN '/api/assets'
    WHEN module = 'systems' AND action IN ('view','manage') THEN '/api/systems'
    WHEN module = 'services' AND action IN ('view','manage') THEN '/api/services'
    WHEN module = 'licenses' AND action IN ('view','manage') THEN '/api/licenses'
    WHEN module = 'users' AND action IN ('view','manage') THEN '/api/admin/users'
    WHEN module = 'settings' AND action IN ('view','manage') THEN '/api/admin/settings'
    WHEN module = 'operations' AND action IN ('view','manage') THEN '/api/operations'
    ELSE '/api/' || module
  END,
  method = CASE action
    WHEN 'view' THEN 'GET'
    WHEN 'create' THEN 'POST'
    WHEN 'update' THEN 'PUT'
    WHEN 'delete' THEN 'DELETE'
    WHEN 'manage' THEN 'ALL'
    ELSE 'GET'
  END
WHERE route_path IS NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. STAFF_ROLES TABLE — Multiple roles per staff member
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_roles (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid,
  UNIQUE(staff_id, role_id)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. APPROVAL_REQUESTS TABLE — Hierarchical approval workflow
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS approval_requests (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  requester_user_id uuid NOT NULL REFERENCES users(id),
  target_record_type varchar(100) NOT NULL,
  target_record_id uuid NOT NULL,
  action_requested varchar(50) NOT NULL,
  reason text,
  status varchar(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approver_user_id uuid REFERENCES users(id),
  approver_notes text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. RBAC_AUDIT_LOGS TABLE — Dedicated RBAC action logging
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rbac_audit_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  action varchar(100) NOT NULL,
  entity_type varchar(100),
  entity_id uuid,
  details jsonb,
  ip_address varchar(45),
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. SEED SYSTEM ROLES (if missing)
-- ────────────────────────────────────────────────────────────────────────────

-- Ensure the 4 core system roles exist
INSERT INTO roles (name, description, is_system, hierarchy_level, authority_level, is_active)
VALUES
  ('superadmin', 'Full system access — unrestricted', true, 1, 100, true),
  ('admin', 'Administrative access to manage users and settings', true, 2, 80, true),
  ('user', 'Standard authenticated user', true, 5, 40, true),
  ('viewer', 'Read-only access across modules', true, 8, 10, true)
ON CONFLICT (name) DO UPDATE SET
  hierarchy_level = EXCLUDED.hierarchy_level,
  authority_level = EXCLUDED.authority_level,
  is_active = true;

-- Set hierarchy/authority on the existing manager role if it exists
UPDATE roles SET hierarchy_level = 3, authority_level = 60
WHERE name = 'manager' AND authority_level IS NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. SEED COMPREHENSIVE PERMISSIONS (upsert)
-- ────────────────────────────────────────────────────────────────────────────

-- Add any missing permissions for complete coverage
INSERT INTO permissions (module, action, description, name, route_path, method) VALUES
  -- Deals
  ('deals', 'create', 'Create new deals', 'deals_create', '/api/deals', 'POST'),
  ('deals', 'view', 'View deals', 'deals_view', '/api/deals', 'GET'),
  ('deals', 'update', 'Update deals', 'deals_update', '/api/deals', 'PUT'),
  ('deals', 'delete', 'Delete deals', 'deals_delete', '/api/deals', 'DELETE'),
  -- Payments
  ('payments', 'create', 'Record payments', 'payments_create', '/api/payments', 'POST'),
  ('payments', 'view', 'View payments', 'payments_view', '/api/payments', 'GET'),
  ('payments', 'update', 'Update payments', 'payments_update', '/api/payments', 'PUT'),
  ('payments', 'delete', 'Delete payments', 'payments_delete', '/api/payments', 'DELETE'),
  -- Clients
  ('clients', 'create', 'Create clients', 'clients_create', '/api/clients', 'POST'),
  ('clients', 'view', 'View clients', 'clients_view', '/api/clients', 'GET'),
  ('clients', 'update', 'Update clients', 'clients_update', '/api/clients', 'PUT'),
  ('clients', 'delete', 'Delete clients', 'clients_delete', '/api/clients', 'DELETE'),
  -- Invoices
  ('invoices', 'create', 'Create invoices', 'invoices_create', '/api/invoices', 'POST'),
  ('invoices', 'view', 'View invoices', 'invoices_view', '/api/invoices', 'GET'),
  ('invoices', 'update', 'Update invoices', 'invoices_update', '/api/invoices', 'PUT'),
  ('invoices', 'delete', 'Delete invoices', 'invoices_delete', '/api/invoices', 'DELETE'),
  -- Staff / Employees
  ('employees', 'create', 'Add employees', 'employees_create', '/api/staff', 'POST'),
  ('employees', 'view', 'View employees', 'employees_view', '/api/staff', 'GET'),
  ('employees', 'update', 'Edit employees', 'employees_update', '/api/staff', 'PUT'),
  ('employees', 'delete', 'Remove employees', 'employees_delete', '/api/staff', 'DELETE'),
  -- Expenses
  ('expenses', 'create', 'Create expenses', 'expenses_create', '/api/expenses', 'POST'),
  ('expenses', 'view', 'View expenses', 'expenses_view', '/api/expenses', 'GET'),
  ('expenses', 'update', 'Update expenses', 'expenses_update', '/api/expenses', 'PUT'),
  ('expenses', 'delete', 'Delete expenses', 'expenses_delete', '/api/expenses', 'DELETE'),
  -- Finance / Ledger
  ('finance', 'view', 'View financial data', 'finance_view', '/api/finance', 'GET'),
  ('finance', 'create', 'Create financial entries', 'finance_create', '/api/finance', 'POST'),
  ('finance', 'manage', 'Manage financial settings', 'finance_manage', '/api/finance', 'ALL'),
  -- Accounts
  ('accounts', 'view', 'View accounts', 'accounts_view', '/api/accounts', 'GET'),
  ('accounts', 'create', 'Create accounts', 'accounts_create', '/api/accounts', 'POST'),
  ('accounts', 'update', 'Update accounts', 'accounts_update', '/api/accounts', 'PUT'),
  ('accounts', 'delete', 'Delete accounts', 'accounts_delete', '/api/accounts', 'DELETE'),
  -- Budgets
  ('budgets', 'view', 'View budgets', 'budgets_view', '/api/budgets', 'GET'),
  ('budgets', 'create', 'Create budgets', 'budgets_create', '/api/budgets', 'POST'),
  ('budgets', 'update', 'Update budgets', 'budgets_update', '/api/budgets', 'PUT'),
  ('budgets', 'delete', 'Delete budgets', 'budgets_delete', '/api/budgets', 'DELETE'),
  -- Products
  ('products', 'view', 'View products', 'products_view', '/api/products', 'GET'),
  ('products', 'create', 'Create products', 'products_create', '/api/products', 'POST'),
  ('products', 'update', 'Update products', 'products_update', '/api/products', 'PUT'),
  ('products', 'delete', 'Delete products', 'products_delete', '/api/products', 'DELETE'),
  -- Prospects / Pipeline
  ('prospects', 'create', 'Create prospects', 'prospects_create', '/api/prospects', 'POST'),
  ('prospects', 'view', 'View prospects', 'prospects_view', '/api/prospects', 'GET'),
  ('prospects', 'update', 'Update prospects', 'prospects_update', '/api/prospects', 'PUT'),
  ('prospects', 'delete', 'Delete prospects', 'prospects_delete', '/api/prospects', 'DELETE'),
  ('pipeline', 'view', 'View pipeline', 'pipeline_view', '/api/pipeline', 'GET'),
  ('pipeline', 'manage', 'Manage pipeline stages', 'pipeline_manage', '/api/pipeline', 'ALL'),
  -- Systems & Services
  ('systems', 'view', 'View systems', 'systems_view', '/api/systems', 'GET'),
  ('systems', 'manage', 'Manage systems', 'systems_manage', '/api/systems', 'ALL'),
  ('services', 'view', 'View services', 'services_view', '/api/services', 'GET'),
  ('services', 'manage', 'Manage services', 'services_manage', '/api/services', 'ALL'),
  ('licenses', 'view', 'View licenses', 'licenses_view', '/api/licenses', 'GET'),
  ('licenses', 'manage', 'Manage licenses', 'licenses_manage', '/api/licenses', 'ALL'),
  -- Admin
  ('users', 'view', 'View users', 'users_view', '/api/admin/users', 'GET'),
  ('users', 'manage', 'Manage users', 'users_manage', '/api/admin/users', 'ALL'),
  ('settings', 'view', 'View settings', 'settings_view', '/api/admin/settings', 'GET'),
  ('settings', 'manage', 'Manage settings', 'settings_manage', '/api/admin/settings', 'ALL'),
  ('roles', 'view', 'View roles', 'roles_view', '/api/admin/roles', 'GET'),
  ('roles', 'manage', 'Manage roles', 'roles_manage', '/api/admin/roles', 'ALL'),
  -- Assets & Liabilities
  ('assets', 'view', 'View assets', 'assets_view', '/api/assets', 'GET'),
  ('assets', 'manage', 'Manage assets', 'assets_manage', '/api/assets', 'ALL'),
  ('liabilities', 'view', 'View liabilities', 'liabilities_view', '/api/liabilities', 'GET'),
  ('liabilities', 'manage', 'Manage liabilities', 'liabilities_manage', '/api/liabilities', 'ALL'),
  -- Departments
  ('departments', 'view', 'View departments', 'departments_view', '/api/departments', 'GET'),
  ('departments', 'manage', 'Manage departments', 'departments_manage', '/api/departments', 'ALL'),
  -- Notifications
  ('notifications', 'view', 'View notifications', 'notifications_view', '/api/notifications', 'GET'),
  ('notifications', 'manage', 'Manage notifications', 'notifications_manage', '/api/notifications', 'ALL'),
  -- Operations
  ('operations', 'view', 'View operations dashboard', 'operations_view', '/api/operations', 'GET'),
  ('operations', 'manage', 'Manage operations', 'operations_manage', '/api/operations', 'ALL')
ON CONFLICT (module, action) DO UPDATE SET
  name = EXCLUDED.name,
  route_path = EXCLUDED.route_path,
  method = EXCLUDED.method;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. DEFAULT ROLE PERMISSIONS
-- Grant superadmin ALL permissions, admin most, viewer view-only
-- ────────────────────────────────────────────────────────────────────────────

-- Superadmin gets everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'superadmin'
ON CONFLICT DO NOTHING;

-- Admin gets everything except roles.manage, settings.manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin' AND NOT (p.module = 'roles' AND p.action = 'manage')
ON CONFLICT DO NOTHING;

-- User role gets create/view/update on common modules
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'user' AND p.action IN ('view', 'create', 'update')
  AND p.module IN ('deals', 'payments', 'clients', 'invoices', 'prospects', 'pipeline', 'notifications')
ON CONFLICT DO NOTHING;

-- Viewer gets view-only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'viewer' AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. INDEXES for performance
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_staff_roles_staff ON staff_roles(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_roles_role ON staff_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON approval_requests(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_logs_user ON rbac_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_logs_action ON rbac_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_permissions_route ON permissions(route_path);
CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(is_active);
CREATE INDEX IF NOT EXISTS idx_roles_authority ON roles(authority_level);

COMMIT;
