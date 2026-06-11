--
-- Safe bootstrap seed for Consty.
-- Includes only generic operational defaults and a demo superadmin account.
--

BEGIN;

-- ---------------------------------------------------------------------------
-- Company settings
-- ---------------------------------------------------------------------------

INSERT INTO public.company_settings (key, value) VALUES
  ('company_name', 'Consty'),
  ('company_tagline', 'Construction delivery, procurement, and project control in one workspace'),
  ('company_address', ''),
  ('company_phone_1', ''),
  ('company_phone_2', ''),
  ('company_phone_3', ''),
  ('company_email', 'info@consty.local'),
  ('company_website', 'https://consty.example.com'),
  ('company_logo', ''),
  ('company_tin', ''),
  ('company_registration', 'consty')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ---------------------------------------------------------------------------
-- Departments
-- ---------------------------------------------------------------------------

INSERT INTO public.departments (
  id,
  department_name,
  description,
  name,
  alias,
  color,
  is_active
) VALUES
  ('0d9b2d4e-28f5-4b1b-8d34-2f3c26d44201', 'Project Delivery', 'Coordinates project execution from mobilization to handover.', 'Project Delivery', 'Projects', '#0f766e', TRUE),
  ('66c22d9c-7d50-4660-8fc9-78d79b57b102', 'Site Operations', 'Oversees day-to-day site activity, reporting, and workforce coordination.', 'Site Operations', 'Sites', '#1d4ed8', TRUE),
  ('2f6ef112-48db-4a07-83e6-ec4aa0963103', 'Procurement', 'Manages suppliers, material requests, approvals, and deliveries.', 'Procurement', 'Materials', '#d97706', TRUE),
  ('12f83b0e-2a14-41d9-a5f3-6bc8f912d404', 'Finance', 'Tracks payments, expenses, invoices, and project cash flow.', 'Finance', 'Finance', '#111827', TRUE),
  ('f44eb9a6-b7fb-42ec-a2d7-2072f11b5505', 'Commercial', 'Owns bidding, client follow-up, proposals, and contract conversion.', 'Commercial', 'Commercial', '#7c3aed', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

INSERT INTO public.roles (
  id,
  name,
  description,
  is_system,
  department_id,
  authority_level,
  hierarchy_level,
  is_active,
  data_scope
) VALUES
  ('1f92a639-6bcf-4d70-9a9f-7a8e0d53a101', 'superadmin', 'Full system access across Consty.', TRUE, NULL, 100, 1, TRUE, 'GLOBAL'),
  ('92f2e93c-a817-4e74-b977-1ea90584a102', 'admin', 'Administrative access for workspace configuration and oversight.', TRUE, NULL, 80, 2, TRUE, 'GLOBAL'),
  ('7d5fd79f-e7d1-4f3e-93c7-0f5b2d0ae103', 'project_manager', 'Coordinates projects, documents, and delivery updates.', FALSE, '0d9b2d4e-28f5-4b1b-8d34-2f3c26d44201', 70, 3, TRUE, 'GLOBAL'),
  ('3d4f07cb-df8f-4f95-9607-b8cfd8240104', 'site_supervisor', 'Manages site execution, reports, and day-to-day progress.', FALSE, '66c22d9c-7d50-4660-8fc9-78d79b57b102', 60, 4, TRUE, 'DEPARTMENT'),
  ('4b0f8a8f-0977-44d5-8942-59ad52dd0105', 'finance_manager', 'Controls financial records, billing, and payment workflows.', FALSE, '12f83b0e-2a14-41d9-a5f3-6bc8f912d404', 65, 4, TRUE, 'GLOBAL'),
  ('5a86d702-08f1-4e9f-bf58-fb0c90c90106', 'viewer', 'Read-only access to operational data.', TRUE, NULL, 30, 8, TRUE, 'OWN'),
  ('6cc11aa1-62de-4c88-a1c8-dc024cc90107', 'user', 'Standard authenticated user role.', TRUE, NULL, 40, 6, TRUE, 'OWN')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (module, action, description, name, route_path, method) VALUES
  ('dashboard', 'view', 'View the operational dashboard', 'dashboard_view', '/api/dashboard', 'GET'),
  ('pipeline', 'view', 'View the bid and opportunity pipeline', 'pipeline_view', '/api/pipeline', 'GET'),
  ('prospects', 'view', 'View leads and opportunities', 'prospects_view', '/api/prospects', 'GET'),
  ('prospects', 'create', 'Create opportunities', 'prospects_create', '/api/prospects', 'POST'),
  ('prospects', 'edit', 'Update opportunities', 'prospects_edit', '/api/prospects', 'PUT'),
  ('prospects', 'delete', 'Delete opportunities', 'prospects_delete', '/api/prospects', 'DELETE'),
  ('clients', 'view', 'View clients', 'clients_view', '/api/clients', 'GET'),
  ('clients', 'create', 'Create clients', 'clients_create', '/api/clients', 'POST'),
  ('clients', 'edit', 'Update clients', 'clients_edit', '/api/clients', 'PUT'),
  ('clients', 'delete', 'Delete clients', 'clients_delete', '/api/clients', 'DELETE'),
  ('deals', 'view', 'View projects', 'deals_view', '/api/deals', 'GET'),
  ('deals', 'create', 'Create projects', 'deals_create', '/api/deals', 'POST'),
  ('deals', 'edit', 'Update projects', 'deals_edit', '/api/deals', 'PUT'),
  ('deals', 'delete', 'Delete projects', 'deals_delete', '/api/deals', 'DELETE'),
  ('payments', 'view', 'View payment records', 'payments_view', '/api/payments', 'GET'),
  ('payments', 'create', 'Record payments', 'payments_create', '/api/payments', 'POST'),
  ('payments', 'update', 'Update payments', 'payments_update', '/api/payments', 'PUT'),
  ('payments', 'delete', 'Delete payments', 'payments_delete', '/api/payments', 'DELETE'),
  ('invoices', 'view', 'View invoices and billing certificates', 'invoices_view', '/api/invoices', 'GET'),
  ('invoices', 'create', 'Create invoices', 'invoices_create', '/api/invoices', 'POST'),
  ('invoices', 'update', 'Update invoices', 'invoices_update', '/api/invoices', 'PUT'),
  ('invoices', 'delete', 'Delete invoices', 'invoices_delete', '/api/invoices', 'DELETE'),
  ('finance', 'view', 'View financial data', 'finance_view', '/api/finance', 'GET'),
  ('finance', 'create', 'Create financial entries', 'finance_create', '/api/finance', 'POST'),
  ('finance', 'edit', 'Update financial entries', 'finance_edit', '/api/finance', 'PUT'),
  ('finance', 'delete', 'Delete financial entries', 'finance_delete', '/api/finance', 'DELETE'),
  ('finance', 'manage', 'Manage financial settings', 'finance_manage', '/api/finance', 'ALL'),
  ('accounts', 'view', 'View accounts', 'accounts_view', '/api/accounts', 'GET'),
  ('accounts', 'create', 'Create accounts', 'accounts_create', '/api/accounts', 'POST'),
  ('accounts', 'update', 'Update accounts', 'accounts_update', '/api/accounts', 'PUT'),
  ('accounts', 'delete', 'Delete accounts', 'accounts_delete', '/api/accounts', 'DELETE'),
  ('expenses', 'view', 'View expenses', 'expenses_view', '/api/expenses', 'GET'),
  ('expenses', 'create', 'Create expenses', 'expenses_create', '/api/expenses', 'POST'),
  ('expenses', 'update', 'Update expenses', 'expenses_update', '/api/expenses', 'PUT'),
  ('expenses', 'delete', 'Delete expenses', 'expenses_delete', '/api/expenses', 'DELETE'),
  ('budgets', 'view', 'View budgets', 'budgets_view', '/api/budgets', 'GET'),
  ('budgets', 'create', 'Create budgets', 'budgets_create', '/api/budgets', 'POST'),
  ('budgets', 'update', 'Update budgets', 'budgets_update', '/api/budgets', 'PUT'),
  ('budgets', 'delete', 'Delete budgets', 'budgets_delete', '/api/budgets', 'DELETE'),
  ('documents', 'view', 'View project documents', 'documents_view', '/api/documents', 'GET'),
  ('documents', 'create', 'Create project documents', 'documents_create', '/api/documents', 'POST'),
  ('documents', 'update', 'Update project documents', 'documents_update', '/api/documents', 'PUT'),
  ('documents', 'delete', 'Delete project documents', 'documents_delete', '/api/documents', 'DELETE'),
  ('media', 'view', 'View uploaded media', 'media_view', '/api/media', 'GET'),
  ('media', 'upload', 'Upload media assets', 'media_upload', '/api/media/upload', 'POST'),
  ('staff', 'view', 'View team members', 'staff_view', '/api/staff', 'GET'),
  ('staff', 'create', 'Create team member records', 'staff_create', '/api/staff', 'POST'),
  ('staff', 'update', 'Update team member records', 'staff_update', '/api/staff', 'PUT'),
  ('staff', 'delete', 'Delete team member records', 'staff_delete', '/api/staff', 'DELETE'),
  ('users', 'view', 'View user accounts', 'users_view', '/api/admin/users', 'GET'),
  ('users', 'create', 'Create user accounts', 'users_create', '/api/admin/users', 'POST'),
  ('users', 'update', 'Update user accounts', 'users_update', '/api/admin/users', 'PUT'),
  ('users', 'delete', 'Delete user accounts', 'users_delete', '/api/admin/users', 'DELETE'),
  ('roles', 'view', 'View roles', 'roles_view', '/api/admin/roles', 'GET'),
  ('roles', 'manage', 'Manage roles and permissions', 'roles_manage', '/api/admin/roles', 'ALL'),
  ('departments', 'view', 'View departments', 'departments_view', '/api/admin/departments', 'GET'),
  ('departments', 'manage', 'Manage departments', 'departments_manage', '/api/admin/departments', 'ALL'),
  ('reports', 'view', 'View reports', 'reports_view', '/api/reports', 'GET'),
  ('reports', 'export', 'Export reports', 'reports_export', '/api/reports', 'POST'),
  ('settings', 'view', 'View settings', 'settings_view', '/api/settings', 'GET'),
  ('settings', 'edit', 'Update settings', 'settings_edit', '/api/settings', 'PUT'),
  ('systems', 'view', 'View site systems and integrations', 'systems_view', '/api/systems', 'GET'),
  ('systems', 'manage', 'Manage site systems and integrations', 'systems_manage', '/api/systems', 'ALL'),
  ('services', 'view', 'View services', 'services_view', '/api/services', 'GET'),
  ('products', 'view', 'View materials and products', 'products_view', '/api/products', 'GET'),
  ('knowledge', 'view', 'View knowledge base content', 'knowledge_view', '/api/knowledge', 'GET'),
  ('operations', 'view', 'View operations log', 'operations_view', '/api/operations', 'GET'),
  ('allocations', 'view', 'View allocations', 'allocations_view', '/api/allocations', 'GET'),
  ('licenses', 'view', 'View licenses', 'licenses_view', '/api/licenses', 'GET'),
  ('pricing', 'view', 'View pricing plans', 'pricing_view', '/api/pricing', 'GET'),
  ('pricing', 'manage', 'Manage pricing plans', 'pricing_manage', '/api/pricing', 'ALL'),
  ('subscriptions', 'view', 'View subscriptions', 'subscriptions_view', '/api/subscriptions', 'GET'),
  ('subscriptions', 'manage', 'Manage subscriptions', 'subscriptions_manage', '/api/subscriptions', 'ALL'),
  ('communication', 'view', 'View communication tools', 'communication_view', '/api/communication', 'GET'),
  ('communication', 'admin', 'Administer communication settings', 'communication_admin', '/api/communication/admin/settings', 'ALL'),
  ('designs', 'view', 'View design assets', 'designs_view', '/api/designs', 'GET'),
  ('designs', 'create', 'Create design assets', 'designs_create', '/api/designs', 'POST'),
  ('activity_logs', 'view', 'View activity logs', 'activity_logs_view', '/api/activity', 'GET'),
  ('approvals', 'view', 'View approvals', 'approvals_view', '/api/approvals', 'GET'),
  ('approvals', 'manage', 'Manage approvals', 'approvals_manage', '/api/approvals', 'ALL'),
  ('backups', 'view', 'View backups', 'backups_view', '/api/backups', 'GET'),
  ('backups', 'delete', 'Delete backups', 'backups_delete', '/api/backups', 'DELETE')
ON CONFLICT (module, action) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Role permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'superadmin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin'
  AND NOT (p.module = 'roles' AND p.action = 'manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON (
  (p.module IN ('dashboard', 'pipeline', 'prospects', 'clients', 'deals', 'payments', 'invoices', 'documents', 'media', 'reports', 'activity_logs') AND p.action IN ('view', 'create', 'edit', 'update'))
  OR (p.module = 'communication' AND p.action = 'view')
)
WHERE r.name = 'project_manager'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON (
  (p.module IN ('dashboard', 'deals', 'documents', 'media', 'activity_logs', 'staff') AND p.action IN ('view', 'create', 'edit', 'update', 'upload'))
)
WHERE r.name = 'site_supervisor'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON (
  (p.module IN ('dashboard', 'finance', 'accounts', 'expenses', 'budgets', 'payments', 'invoices', 'reports', 'allocations') AND p.action IN ('view', 'create', 'edit', 'update', 'export', 'manage'))
)
WHERE r.name = 'finance_manager'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.action = 'view'
WHERE r.name IN ('viewer', 'user')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Document categories
-- ---------------------------------------------------------------------------

INSERT INTO public.document_categories (name, description, is_active) VALUES
  ('contracts', 'Contracts, awards, and formal agreements', TRUE),
  ('site_reports', 'Daily, weekly, and milestone site reports', TRUE),
  ('procurement', 'Purchase requests, supplier quotes, and delivery notes', TRUE),
  ('invoices', 'Invoices, payment certificates, and billing records', TRUE),
  ('compliance', 'Approvals, permits, safety, and compliance records', TRUE)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Media permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.media_permissions (file_type, allowed, max_size_mb, allowed_mimetypes) VALUES
  ('image', TRUE, 50, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('video', TRUE, 500, ARRAY['video/mp4', 'video/webm', 'video/quicktime']),
  ('audio', TRUE, 200, ARRAY['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg']),
  ('document', TRUE, 100, ARRAY['application/pdf', 'application/msword']),
  ('spreadsheet', TRUE, 100, ARRAY['application/vnd.ms-excel'])
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Bootstrap superadmin user
-- Email: admin@consty.local
-- Password: ChangeMe!2026
-- ---------------------------------------------------------------------------

INSERT INTO public.users (
  email,
  password_hash,
  name,
  role,
  is_active,
  status,
  must_reset_password,
  username,
  authority_level,
  first_login_completed
) VALUES (
  'admin@consty.local',
  '$2b$10$xDDq8UN2bfX2kI4WdbCCxuHJ8UZ.3q29yphYJcxIy2btD9S7C8Y2.',
  'Consty Admin',
  'superadmin',
  TRUE,
  'active',
  TRUE,
  'consty.admin',
  100,
  FALSE
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM public.users u
JOIN public.roles r ON r.name = 'superadmin'
WHERE u.email = 'admin@consty.local'
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;
