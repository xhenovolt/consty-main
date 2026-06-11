-- ============================================================================
-- USER & ACCESS GOVERNANCE SYSTEM
-- Enterprise-grade RBAC, sessions, audit trails, and activity tracking
-- ============================================================================

-- ============================================================================
-- 1. ENHANCED USERS TABLE
-- ============================================================================

-- Drop old role constraint and add new status options
ALTER TABLE users 
  DROP CONSTRAINT IF EXISTS valid_role,
  DROP CONSTRAINT IF EXISTS valid_status;

-- Add new columns to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'dormant',
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Update constraints
ALTER TABLE users
  ADD CONSTRAINT valid_status_new CHECK (status IN ('active', 'inactive', 'dormant', 'suspended')),
  ADD CONSTRAINT email_format CHECK (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$');

-- Ensure the bootstrap admin keeps superadmin access
UPDATE users SET is_superadmin = true WHERE email = 'admin@consty.local';

-- Create index for username
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_superadmin ON users(is_superadmin);

-- ============================================================================
-- 2. ROLES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN DEFAULT false, -- System roles cannot be deleted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert system roles
INSERT INTO roles (name, description, is_system) VALUES
  ('superadmin', 'Full system access - cannot be deleted or modified', true),
  ('admin', 'Administrative access with ability to manage users and permissions', true),
  ('staff', 'Staff member with module-specific permissions', true),
  ('viewer', 'Read-only access to assigned modules', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 3. PERMISSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  module VARCHAR(50) NOT NULL, -- 'assets', 'liabilities', 'deals', 'pipeline', 'shares', 'staff', 'reports', 'settings', 'audit_logs', 'users'
  action VARCHAR(20) NOT NULL, -- 'view', 'create', 'update', 'delete'
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_action CHECK (action IN ('view', 'create', 'update', 'delete'))
);

-- Insert standard permissions for each module
INSERT INTO permissions (name, description, module, action, is_system) VALUES
  -- Assets
  ('assets.view', 'View assets', 'assets', 'view', true),
  ('assets.create', 'Create assets', 'assets', 'create', true),
  ('assets.update', 'Update assets', 'assets', 'update', true),
  ('assets.delete', 'Delete assets', 'assets', 'delete', true),
  
  -- Liabilities
  ('liabilities.view', 'View liabilities', 'liabilities', 'view', true),
  ('liabilities.create', 'Create liabilities', 'liabilities', 'create', true),
  ('liabilities.update', 'Update liabilities', 'liabilities', 'update', true),
  ('liabilities.delete', 'Delete liabilities', 'liabilities', 'delete', true),
  
  -- Deals
  ('deals.view', 'View deals', 'deals', 'view', true),
  ('deals.create', 'Create deals', 'deals', 'create', true),
  ('deals.update', 'Update deals', 'deals', 'update', true),
  ('deals.delete', 'Delete deals', 'deals', 'delete', true),
  
  -- Pipeline
  ('pipeline.view', 'View pipeline', 'pipeline', 'view', true),
  ('pipeline.create', 'Create pipeline items', 'pipeline', 'create', true),
  ('pipeline.update', 'Update pipeline items', 'pipeline', 'update', true),
  ('pipeline.delete', 'Delete pipeline items', 'pipeline', 'delete', true),
  
  -- Shares
  ('shares.view', 'View shares', 'shares', 'view', true),
  ('shares.create', 'Create share records', 'shares', 'create', true),
  ('shares.update', 'Update shares', 'shares', 'update', true),
  ('shares.delete', 'Delete shares', 'shares', 'delete', true),
  
  -- Staff
  ('staff.view', 'View staff', 'staff', 'view', true),
  ('staff.create', 'Create staff records', 'staff', 'create', true),
  ('staff.update', 'Update staff', 'staff', 'update', true),
  ('staff.delete', 'Delete staff', 'staff', 'delete', true),
  
  -- Reports
  ('reports.view', 'View reports', 'reports', 'view', true),
  ('reports.create', 'Create reports', 'reports', 'create', true),
  ('reports.update', 'Update reports', 'reports', 'update', true),
  ('reports.delete', 'Delete reports', 'reports', 'delete', true),
  
  -- Settings
  ('settings.view', 'View settings', 'settings', 'view', true),
  ('settings.update', 'Update settings', 'settings', 'update', true),
  
  -- Audit Logs
  ('audit_logs.view', 'View audit logs', 'audit_logs', 'view', true),
  
  -- Users
  ('users.view', 'View users', 'users', 'view', true),
  ('users.create', 'Create users', 'users', 'create', true),
  ('users.update', 'Update users', 'users', 'update', true),
  ('users.delete', 'Delete users', 'users', 'delete', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 4. ROLE_PERMISSIONS JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_role_permission UNIQUE(role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- ============================================================================
-- 5. USER_ROLES JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  assigned_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  CONSTRAINT unique_user_role UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- ============================================================================
-- 6. SESSIONS TABLE (Enterprise Session Management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_name VARCHAR(255),
  browser VARCHAR(100),
  os VARCHAR(100),
  ip_address INET,
  country VARCHAR(100),
  city VARCHAR(100),
  user_agent TEXT,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  killed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  killed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_token_hash CHECK (length(token_hash) > 0)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ============================================================================
-- 7. AUDIT_LOGS TABLE (Enhanced - Immutable)
-- ============================================================================

ALTER TABLE audit_logs 
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS changes JSONB;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ============================================================================
-- 8. ACTIVITY_LOGS TABLE (Behavior Analytics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  action_type VARCHAR(100) NOT NULL, -- 'page_view', 'feature_used', 'api_call', 'export', etc.
  module VARCHAR(50), -- Which module (assets, deals, etc.)
  resource_type VARCHAR(50), -- Type of resource accessed
  resource_id VARCHAR(100), -- ID of resource accessed
  path VARCHAR(500), -- Route/page accessed
  metadata JSONB, -- Additional context
  duration_ms INT, -- How long the action took
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module);

-- ============================================================================
-- 9. USER_PERMISSIONS TABLE (Override mechanism)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  granted_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_user_permission UNIQUE(user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);

-- ============================================================================
-- 10. STAFF_USER_LINK TABLE (Staff ↔ User Linking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_user_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  linked_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  CONSTRAINT unique_user_staff UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_user_link_user_id ON staff_user_link(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_user_link_staff_id ON staff_user_link(staff_id);

-- ============================================================================
-- SETUP DEFAULT ROLE PERMISSIONS
-- ============================================================================

-- Superadmin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'superadmin'
ON CONFLICT DO NOTHING;

-- Admin gets most permissions (except some critical ones)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'admin' AND p.name NOT LIKE '%audit_logs.delete'
ON CONFLICT DO NOTHING;

-- Staff gets module-specific permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'staff' AND p.action IN ('view', 'create', 'update')
ON CONFLICT DO NOTHING;

-- Viewer gets view-only permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'viewer' AND p.action = 'view'
ON CONFLICT DO NOTHING;
