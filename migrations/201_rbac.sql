-- =============================================================================
-- RBAC Migration - Roles, Permissions, Role_Permissions, User_Roles
-- =============================================================================

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Permissions table  
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(module, action)
);

-- Role-Permission mapping (many-to-many)
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- User-Role mapping (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- Ensure status column exists on users (may already exist from prior migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'status'
  ) THEN
    ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
  END IF;
END $$;

-- =============================================================================
-- Seed default system roles
-- =============================================================================
INSERT INTO roles (name, description, is_system) VALUES
  ('superadmin', 'Full system access - cannot be deleted', true),
  ('admin', 'Administrative access - user management, system config', true),
  ('user', 'Standard user - full module access', true),
  ('viewer', 'Read-only access to all modules', true)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- Seed default permissions (module + action)
-- =============================================================================
INSERT INTO permissions (module, action, description) VALUES
  -- Dashboard
  ('dashboard', 'view', 'View dashboard'),
  -- Prospects
  ('prospects', 'view', 'View prospects'),
  ('prospects', 'create', 'Create prospects'),
  ('prospects', 'edit', 'Edit prospects'),
  ('prospects', 'delete', 'Delete prospects'),
  -- Clients
  ('clients', 'view', 'View clients'),
  ('clients', 'create', 'Create clients'),
  ('clients', 'edit', 'Edit clients'),
  ('clients', 'delete', 'Delete clients'),
  -- Deals
  ('deals', 'view', 'View deals'),
  ('deals', 'create', 'Create deals'),
  ('deals', 'edit', 'Edit deals'),
  ('deals', 'delete', 'Delete deals'),
  -- Finance
  ('finance', 'view', 'View financial data'),
  ('finance', 'create', 'Create transactions'),
  ('finance', 'edit', 'Edit transactions'),
  ('finance', 'delete', 'Delete transactions'),
  -- Offerings
  ('offerings', 'view', 'View offerings'),
  ('offerings', 'create', 'Create offerings'),
  ('offerings', 'edit', 'Edit offerings'),
  ('offerings', 'delete', 'Delete offerings'),
  -- Reports
  ('reports', 'view', 'View reports'),
  ('reports', 'export', 'Export reports'),
  -- Users (admin)
  ('users', 'view', 'View user accounts'),
  ('users', 'create', 'Create user accounts'),
  ('users', 'edit', 'Edit user accounts'),
  ('users', 'delete', 'Delete user accounts'),
  ('users', 'activate', 'Activate/deactivate users'),
  -- Roles (admin)
  ('roles', 'view', 'View roles'),
  ('roles', 'create', 'Create roles'),
  ('roles', 'edit', 'Edit roles'),
  ('roles', 'delete', 'Delete roles'),
  -- Audit
  ('audit', 'view', 'View audit logs'),
  -- Settings
  ('settings', 'view', 'View settings'),
  ('settings', 'edit', 'Edit settings')
ON CONFLICT (module, action) DO NOTHING;

-- =============================================================================
-- Assign all permissions to superadmin role
-- =============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'superadmin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign all permissions except user/role/audit management to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND NOT (p.module = 'roles' AND p.action IN ('create', 'edit', 'delete'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign view + create + edit permissions to user role (no delete, no admin modules)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'user'
  AND p.module NOT IN ('users', 'roles', 'audit')
  AND p.action IN ('view', 'create', 'edit', 'export')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign only view permissions to viewer role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'viewer'
  AND p.action = 'view'
  AND p.module NOT IN ('users', 'roles', 'audit')
ON CONFLICT (role_id, permission_id) DO NOTHING;
