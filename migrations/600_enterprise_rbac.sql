-- =============================================================================
-- ENTERPRISE RBAC MIGRATION
-- Hierarchy levels, expanded permissions, approval workflows, audit logging
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add hierarchy_level and route_path to existing tables
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'hierarchy_level'
  ) THEN
    ALTER TABLE roles ADD COLUMN hierarchy_level INTEGER NOT NULL DEFAULT 5;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permissions' AND column_name = 'route_path'
  ) THEN
    ALTER TABLE permissions ADD COLUMN route_path VARCHAR(255);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Update system roles with hierarchy levels
-- ---------------------------------------------------------------------------
UPDATE roles SET hierarchy_level = 1 WHERE name = 'superadmin';
UPDATE roles SET hierarchy_level = 2 WHERE name = 'admin';
UPDATE roles SET hierarchy_level = 3 WHERE name = 'manager';
UPDATE roles SET hierarchy_level = 4 WHERE name = 'user';
UPDATE roles SET hierarchy_level = 5 WHERE name = 'viewer';

-- Add manager role if missing
INSERT INTO roles (name, description, is_system, hierarchy_level) VALUES
  ('manager', 'Department manager - full module access with approval authority', true, 3)
ON CONFLICT (name) DO UPDATE SET hierarchy_level = EXCLUDED.hierarchy_level;

-- Also add executive role
INSERT INTO roles (name, description, is_system, hierarchy_level) VALUES
  ('executive', 'Executive leadership - broad access with high authority', true, 2)
ON CONFLICT (name) DO UPDATE SET hierarchy_level = EXCLUDED.hierarchy_level;

-- ---------------------------------------------------------------------------
-- 3. Approval Requests table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_record_type VARCHAR(100) NOT NULL,
  target_record_id UUID,
  action_requested VARCHAR(100) NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  approver_user_id UUID REFERENCES users(id),
  approver_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON approval_requests(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_approver ON approval_requests(approver_user_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_target ON approval_requests(target_record_type, target_record_id);

-- ---------------------------------------------------------------------------
-- 4. RBAC Audit Log table (dedicated for permission-sensitive actions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rbac_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rbac_audit_action ON rbac_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_user ON rbac_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_created ON rbac_audit_logs(created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Comprehensive permission seeds for ALL modules
-- ---------------------------------------------------------------------------

-- Module: authentication
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('authentication', 'view', 'View authentication settings', '/api/auth'),
  ('authentication', 'create', 'Create authentication tokens', '/api/auth'),
  ('authentication', 'update', 'Update authentication settings', '/api/auth'),
  ('authentication', 'delete', 'Revoke authentication sessions', '/api/auth'),
  ('authentication', 'export', 'Export authentication logs', '/api/auth')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: users
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('users', 'view', 'View user accounts', '/api/admin/users'),
  ('users', 'create', 'Create user accounts', '/api/admin/users'),
  ('users', 'update', 'Update user accounts', '/api/admin/users'),
  ('users', 'delete', 'Delete user accounts', '/api/admin/users'),
  ('users', 'approve', 'Approve user registrations', '/api/admin/users'),
  ('users', 'export', 'Export user data', '/api/admin/users'),
  ('users', 'assign', 'Assign roles to users', '/api/admin/users')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: roles
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('roles', 'view', 'View roles', '/api/admin/roles'),
  ('roles', 'create', 'Create roles', '/api/admin/roles'),
  ('roles', 'update', 'Update roles and permissions', '/api/admin/roles'),
  ('roles', 'delete', 'Delete roles', '/api/admin/roles'),
  ('roles', 'export', 'Export role data', '/api/admin/roles'),
  ('roles', 'assign', 'Assign permissions to roles', '/api/admin/roles')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: prospects
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('prospects', 'view', 'View prospects', '/api/prospects'),
  ('prospects', 'create', 'Create prospects', '/api/prospects'),
  ('prospects', 'update', 'Update prospects', '/api/prospects'),
  ('prospects', 'delete', 'Delete prospects', '/api/prospects'),
  ('prospects', 'approve', 'Approve prospect actions', '/api/prospects'),
  ('prospects', 'export', 'Export prospects data', '/api/prospects'),
  ('prospects', 'assign', 'Assign prospects to users', '/api/prospects')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: pipeline
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('pipeline', 'view', 'View pipeline', '/api/pipeline'),
  ('pipeline', 'create', 'Create pipeline entries', '/api/pipeline'),
  ('pipeline', 'update', 'Update pipeline entries', '/api/pipeline'),
  ('pipeline', 'delete', 'Delete pipeline entries', '/api/pipeline'),
  ('pipeline', 'approve', 'Approve pipeline changes', '/api/pipeline'),
  ('pipeline', 'export', 'Export pipeline data', '/api/pipeline'),
  ('pipeline', 'assign', 'Assign pipeline items', '/api/pipeline')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: deals
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('deals', 'view', 'View deals', '/api/deals'),
  ('deals', 'create', 'Create deals', '/api/deals'),
  ('deals', 'update', 'Update deals', '/api/deals'),
  ('deals', 'delete', 'Delete deals', '/api/deals'),
  ('deals', 'approve', 'Approve deals', '/api/deals'),
  ('deals', 'export', 'Export deals data', '/api/deals'),
  ('deals', 'assign', 'Assign deals to users', '/api/deals')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: clients
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('clients', 'view', 'View clients', '/api/clients'),
  ('clients', 'create', 'Create clients', '/api/clients'),
  ('clients', 'update', 'Update clients', '/api/clients'),
  ('clients', 'delete', 'Delete clients', '/api/clients'),
  ('clients', 'approve', 'Approve client changes', '/api/clients'),
  ('clients', 'export', 'Export client data', '/api/clients'),
  ('clients', 'assign', 'Assign clients to users', '/api/clients')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: accounts
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('accounts', 'view', 'View financial accounts', '/api/finance/accounts'),
  ('accounts', 'create', 'Create financial accounts', '/api/finance/accounts'),
  ('accounts', 'update', 'Update financial accounts', '/api/finance/accounts'),
  ('accounts', 'delete', 'Delete financial accounts', '/api/finance/accounts'),
  ('accounts', 'approve', 'Approve account changes', '/api/finance/accounts'),
  ('accounts', 'export', 'Export account data', '/api/finance/accounts'),
  ('accounts', 'assign', 'Assign account access', '/api/finance/accounts')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: finance
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('finance', 'view', 'View financial data', '/api/finance'),
  ('finance', 'create', 'Create financial records', '/api/finance'),
  ('finance', 'update', 'Update financial records', '/api/finance'),
  ('finance', 'delete', 'Delete financial records', '/api/finance'),
  ('finance', 'approve', 'Approve financial transactions', '/api/finance'),
  ('finance', 'export', 'Export financial data', '/api/finance'),
  ('finance', 'assign', 'Assign financial responsibilities', '/api/finance')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: budgets
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('budgets', 'view', 'View budgets', '/api/finance/budgets'),
  ('budgets', 'create', 'Create budgets', '/api/finance/budgets'),
  ('budgets', 'update', 'Update budgets', '/api/finance/budgets'),
  ('budgets', 'delete', 'Delete budgets', '/api/finance/budgets'),
  ('budgets', 'approve', 'Approve budget changes', '/api/finance/budgets'),
  ('budgets', 'export', 'Export budget data', '/api/finance/budgets'),
  ('budgets', 'assign', 'Assign budget ownership', '/api/finance/budgets')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: assets
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('assets', 'view', 'View assets', '/api/assets'),
  ('assets', 'create', 'Create assets', '/api/assets'),
  ('assets', 'update', 'Update assets', '/api/assets'),
  ('assets', 'delete', 'Delete assets', '/api/assets'),
  ('assets', 'approve', 'Approve asset changes', '/api/assets'),
  ('assets', 'export', 'Export asset data', '/api/assets'),
  ('assets', 'assign', 'Assign asset ownership', '/api/assets')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: infrastructure
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('infrastructure', 'view', 'View infrastructure', '/api/infrastructure'),
  ('infrastructure', 'create', 'Create infrastructure records', '/api/infrastructure'),
  ('infrastructure', 'update', 'Update infrastructure records', '/api/infrastructure'),
  ('infrastructure', 'delete', 'Delete infrastructure records', '/api/infrastructure'),
  ('infrastructure', 'approve', 'Approve infrastructure changes', '/api/infrastructure'),
  ('infrastructure', 'export', 'Export infrastructure data', '/api/infrastructure'),
  ('infrastructure', 'assign', 'Assign infrastructure items', '/api/infrastructure')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: operations
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('operations', 'view', 'View operations log', '/api/operations'),
  ('operations', 'create', 'Create operations entries', '/api/operations'),
  ('operations', 'update', 'Update operations entries', '/api/operations'),
  ('operations', 'delete', 'Delete operations entries', '/api/operations'),
  ('operations', 'approve', 'Approve operations', '/api/operations'),
  ('operations', 'export', 'Export operations data', '/api/operations'),
  ('operations', 'assign', 'Assign operations tasks', '/api/operations')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: notifications
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('notifications', 'view', 'View notifications', '/api/notifications'),
  ('notifications', 'create', 'Create notifications', '/api/notifications'),
  ('notifications', 'update', 'Update notification settings', '/api/notifications'),
  ('notifications', 'delete', 'Delete notifications', '/api/notifications'),
  ('notifications', 'export', 'Export notification logs', '/api/notifications')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: activity_logs
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('activity_logs', 'view', 'View activity logs', '/api/activity'),
  ('activity_logs', 'export', 'Export activity logs', '/api/activity'),
  ('activity_logs', 'delete', 'Purge activity logs', '/api/activity')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: systems
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('systems', 'view', 'View systems', '/api/systems'),
  ('systems', 'create', 'Create systems', '/api/systems'),
  ('systems', 'update', 'Update systems', '/api/systems'),
  ('systems', 'delete', 'Delete systems', '/api/systems'),
  ('systems', 'approve', 'Approve system changes', '/api/systems'),
  ('systems', 'export', 'Export system data', '/api/systems'),
  ('systems', 'assign', 'Assign system ownership', '/api/systems')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: bug_tracking
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('bug_tracking', 'view', 'View bug reports', '/api/bugs'),
  ('bug_tracking', 'create', 'Create bug reports', '/api/bugs'),
  ('bug_tracking', 'update', 'Update bug reports', '/api/bugs'),
  ('bug_tracking', 'delete', 'Delete bug reports', '/api/bugs'),
  ('bug_tracking', 'approve', 'Approve bug fixes', '/api/bugs'),
  ('bug_tracking', 'export', 'Export bug reports', '/api/bugs'),
  ('bug_tracking', 'assign', 'Assign bug reports', '/api/bugs')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: feature_requests
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('feature_requests', 'view', 'View feature requests', '/api/features'),
  ('feature_requests', 'create', 'Create feature requests', '/api/features'),
  ('feature_requests', 'update', 'Update feature requests', '/api/features'),
  ('feature_requests', 'delete', 'Delete feature requests', '/api/features'),
  ('feature_requests', 'approve', 'Approve feature requests', '/api/features'),
  ('feature_requests', 'export', 'Export feature requests', '/api/features'),
  ('feature_requests', 'assign', 'Assign feature requests', '/api/features')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: hrm
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('hrm', 'view', 'View HRM data', '/api/hrm'),
  ('hrm', 'create', 'Create HRM records', '/api/hrm'),
  ('hrm', 'update', 'Update HRM records', '/api/hrm'),
  ('hrm', 'delete', 'Delete HRM records', '/api/hrm'),
  ('hrm', 'approve', 'Approve HRM actions', '/api/hrm'),
  ('hrm', 'export', 'Export HRM data', '/api/hrm'),
  ('hrm', 'assign', 'Assign HRM responsibilities', '/api/hrm')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: departments
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('departments', 'view', 'View departments', '/api/departments'),
  ('departments', 'create', 'Create departments', '/api/departments'),
  ('departments', 'update', 'Update departments', '/api/departments'),
  ('departments', 'delete', 'Delete departments', '/api/departments'),
  ('departments', 'approve', 'Approve department changes', '/api/departments'),
  ('departments', 'export', 'Export department data', '/api/departments'),
  ('departments', 'assign', 'Assign department managers', '/api/departments')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: employees
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('employees', 'view', 'View employees', '/api/staff'),
  ('employees', 'create', 'Create employee records', '/api/staff'),
  ('employees', 'update', 'Update employee records', '/api/staff'),
  ('employees', 'delete', 'Delete employee records', '/api/staff'),
  ('employees', 'approve', 'Approve employee actions', '/api/staff'),
  ('employees', 'export', 'Export employee data', '/api/staff'),
  ('employees', 'assign', 'Assign employee roles', '/api/staff')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: invoices
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('invoices', 'view', 'View invoices', '/api/invoices'),
  ('invoices', 'create', 'Create invoices', '/api/invoices'),
  ('invoices', 'update', 'Update invoices', '/api/invoices'),
  ('invoices', 'delete', 'Delete invoices', '/api/invoices'),
  ('invoices', 'approve', 'Approve invoices', '/api/invoices'),
  ('invoices', 'export', 'Export invoices', '/api/invoices'),
  ('invoices', 'assign', 'Assign invoices', '/api/invoices')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: payments
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('payments', 'view', 'View payments', '/api/payments'),
  ('payments', 'create', 'Record payments', '/api/payments'),
  ('payments', 'update', 'Update payments', '/api/payments'),
  ('payments', 'delete', 'Delete payments', '/api/payments'),
  ('payments', 'approve', 'Approve payments', '/api/payments'),
  ('payments', 'export', 'Export payment data', '/api/payments'),
  ('payments', 'assign', 'Assign payment processing', '/api/payments')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: expenses
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('expenses', 'view', 'View expenses', '/api/expenses'),
  ('expenses', 'create', 'Create expenses', '/api/expenses'),
  ('expenses', 'update', 'Update expenses', '/api/expenses'),
  ('expenses', 'delete', 'Delete expenses', '/api/expenses'),
  ('expenses', 'approve', 'Approve expenses', '/api/expenses'),
  ('expenses', 'export', 'Export expense data', '/api/expenses'),
  ('expenses', 'assign', 'Assign expense reviewers', '/api/expenses')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: contracts
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('contracts', 'view', 'View contracts', '/api/contracts'),
  ('contracts', 'create', 'Create contracts', '/api/contracts'),
  ('contracts', 'update', 'Update contracts', '/api/contracts'),
  ('contracts', 'delete', 'Delete contracts', '/api/contracts'),
  ('contracts', 'approve', 'Approve contracts', '/api/contracts'),
  ('contracts', 'export', 'Export contracts', '/api/contracts'),
  ('contracts', 'assign', 'Assign contracts', '/api/contracts')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: offerings
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('offerings', 'view', 'View offerings', '/api/offerings'),
  ('offerings', 'create', 'Create offerings', '/api/offerings'),
  ('offerings', 'update', 'Update offerings', '/api/offerings'),
  ('offerings', 'delete', 'Delete offerings', '/api/offerings'),
  ('offerings', 'approve', 'Approve offerings', '/api/offerings'),
  ('offerings', 'export', 'Export offerings', '/api/offerings'),
  ('offerings', 'assign', 'Assign offerings', '/api/offerings')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: services
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('services', 'view', 'View services', '/api/services'),
  ('services', 'create', 'Create services', '/api/services'),
  ('services', 'update', 'Update services', '/api/services'),
  ('services', 'delete', 'Delete services', '/api/services'),
  ('services', 'approve', 'Approve service changes', '/api/services'),
  ('services', 'export', 'Export service data', '/api/services'),
  ('services', 'assign', 'Assign service ownership', '/api/services')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: products
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('products', 'view', 'View products', '/api/products'),
  ('products', 'create', 'Create products', '/api/products'),
  ('products', 'update', 'Update products', '/api/products'),
  ('products', 'delete', 'Delete products', '/api/products'),
  ('products', 'approve', 'Approve product changes', '/api/products'),
  ('products', 'export', 'Export product data', '/api/products'),
  ('products', 'assign', 'Assign product ownership', '/api/products')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: licenses
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('licenses', 'view', 'View licenses', '/api/licenses'),
  ('licenses', 'create', 'Create licenses', '/api/licenses'),
  ('licenses', 'update', 'Update licenses', '/api/licenses'),
  ('licenses', 'delete', 'Delete licenses', '/api/licenses'),
  ('licenses', 'approve', 'Approve license changes', '/api/licenses'),
  ('licenses', 'export', 'Export license data', '/api/licenses'),
  ('licenses', 'assign', 'Assign licenses', '/api/licenses')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: knowledge
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('knowledge', 'view', 'View knowledge base', '/api/knowledge'),
  ('knowledge', 'create', 'Create knowledge entries', '/api/knowledge'),
  ('knowledge', 'update', 'Update knowledge entries', '/api/knowledge'),
  ('knowledge', 'delete', 'Delete knowledge entries', '/api/knowledge'),
  ('knowledge', 'export', 'Export knowledge base', '/api/knowledge'),
  ('knowledge', 'assign', 'Assign knowledge items', '/api/knowledge')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: reports
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('reports', 'view', 'View reports', '/api/reports'),
  ('reports', 'create', 'Create custom reports', '/api/reports'),
  ('reports', 'export', 'Export reports', '/api/reports')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: dashboard
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('dashboard', 'view', 'View dashboard', '/api/dashboard')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: settings
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('settings', 'view', 'View settings', '/api/settings'),
  ('settings', 'update', 'Update settings', '/api/settings')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: audit
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('audit', 'view', 'View audit logs', '/api/audit-logs'),
  ('audit', 'export', 'Export audit logs', '/api/audit-logs')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: approvals
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('approvals', 'view', 'View approval requests', '/api/approvals'),
  ('approvals', 'create', 'Submit approval requests', '/api/approvals'),
  ('approvals', 'approve', 'Approve or reject requests', '/api/approvals'),
  ('approvals', 'export', 'Export approval data', '/api/approvals')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: allocations
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('allocations', 'view', 'View allocations', '/api/allocations'),
  ('allocations', 'create', 'Create allocations', '/api/allocations'),
  ('allocations', 'update', 'Update allocations', '/api/allocations'),
  ('allocations', 'delete', 'Delete allocations', '/api/allocations'),
  ('allocations', 'approve', 'Approve allocations', '/api/allocations'),
  ('allocations', 'export', 'Export allocation data', '/api/allocations')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: media
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('media', 'view', 'View media files', '/api/media'),
  ('media', 'create', 'Upload media files', '/api/media'),
  ('media', 'update', 'Update media files', '/api/media'),
  ('media', 'delete', 'Delete media files', '/api/media'),
  ('media', 'export', 'Export media files', '/api/media')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: intelligence
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('intelligence', 'view', 'View intelligence dashboards', '/api/intelligence'),
  ('intelligence', 'export', 'Export intelligence reports', '/api/intelligence')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: documents
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('documents', 'view', 'View documents', '/api/documents'),
  ('documents', 'create', 'Create documents', '/api/documents'),
  ('documents', 'update', 'Update documents', '/api/documents'),
  ('documents', 'delete', 'Delete documents', '/api/documents'),
  ('documents', 'export', 'Export documents', '/api/documents')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- Module: liabilities
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('liabilities', 'view', 'View liabilities', '/api/liabilities'),
  ('liabilities', 'create', 'Create liabilities', '/api/liabilities'),
  ('liabilities', 'update', 'Update liabilities', '/api/liabilities'),
  ('liabilities', 'delete', 'Delete liabilities', '/api/liabilities'),
  ('liabilities', 'approve', 'Approve liability changes', '/api/liabilities'),
  ('liabilities', 'export', 'Export liability data', '/api/liabilities')
ON CONFLICT (module, action) DO UPDATE SET route_path = EXCLUDED.route_path;

-- ---------------------------------------------------------------------------
-- 6. Re-sync role permissions for system roles
-- ---------------------------------------------------------------------------

-- Superadmin gets ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'superadmin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Executive gets all except role/user management
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'executive'
  AND p.module NOT IN ('roles', 'authentication')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admin gets all except superadmin-only actions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND NOT (p.module = 'roles' AND p.action IN ('create', 'delete'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager gets CRUD + approve on business modules, no admin modules
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'manager'
  AND p.module NOT IN ('roles', 'authentication', 'users')
  AND p.action IN ('view', 'create', 'update', 'approve', 'export', 'assign')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- User gets view + create + update on business modules
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'user'
  AND p.module NOT IN ('users', 'roles', 'audit', 'authentication', 'approvals')
  AND p.action IN ('view', 'create', 'update', 'export')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Viewer gets view-only on non-admin modules
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'viewer'
  AND p.action = 'view'
  AND p.module NOT IN ('users', 'roles', 'audit', 'authentication')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. Add created_by column to key tables for hierarchy enforcement
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deals' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE deals ADD COLUMN created_by UUID REFERENCES users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prospects' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE prospects ADD COLUMN created_by UUID REFERENCES users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operations' AND column_name = 'created_by'
  ) THEN
    BEGIN
      ALTER TABLE operations ADD COLUMN created_by UUID REFERENCES users(id);
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;
  END IF;
END $$;
