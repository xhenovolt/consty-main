-- ============================================================
-- MIGRATION 800: Departments Expansion, Dynamic Roles, Media & Backup Architecture
-- Consty Operating System
-- ============================================================

-- ============================================================
-- PART 1: DEPARTMENTS — Drop & Recreate with Full Architecture
-- ============================================================

-- Drop old department-related tables/constraints first
DROP TABLE IF EXISTS department_documents CASCADE;
DROP TABLE IF EXISTS department_processes CASCADE;
DROP TABLE IF EXISTS department_kpis CASCADE;
DROP TABLE IF EXISTS department_policies CASCADE;
DROP TABLE IF EXISTS department_roles CASCADE;

-- Preserve old department data temporarily
CREATE TEMP TABLE _dept_backup AS SELECT * FROM departments;

-- Drop and recreate departments
DROP TABLE IF EXISTS departments CASCADE;

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  alias VARCHAR(100),
  parent_department_id UUID,
  head_user_id UUID,
  color VARCHAR(20) DEFAULT '#3b82f6',
  icon VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Self-referencing FK for hierarchy
ALTER TABLE departments ADD CONSTRAINT fk_dept_parent
  FOREIGN KEY (parent_department_id) REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX idx_departments_parent ON departments(parent_department_id);
CREATE INDEX idx_departments_active ON departments(is_active);
CREATE INDEX idx_departments_name ON departments(name);

-- Restore any old departments that match the new schema
INSERT INTO departments (id, name, description, created_at)
  SELECT id, department_name, description, created_at FROM _dept_backup
  ON CONFLICT (name) DO NOTHING;

DROP TABLE IF EXISTS _dept_backup;

-- ============================================================
-- DEPARTMENT SUB-TABLES
-- ============================================================

-- Department ↔ Roles linking (many-to-many)
CREATE TABLE department_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  is_lead BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(department_id, role_id)
);

CREATE INDEX idx_dept_roles_dept ON department_roles(department_id);
CREATE INDEX idx_dept_roles_role ON department_roles(role_id);

-- Department Policies
CREATE TABLE department_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  document_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dept_policies_dept ON department_policies(department_id);

-- Department KPIs
CREATE TABLE department_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  target_value DECIMAL(15,2),
  current_value DECIMAL(15,2) DEFAULT 0,
  unit VARCHAR(50),
  period VARCHAR(20) DEFAULT 'monthly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dept_kpis_dept ON department_kpis(department_id);

-- Department Processes (workflows)
CREATE TABLE department_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  steps JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dept_process_status CHECK (status IN ('active', 'draft', 'archived'))
);

CREATE INDEX idx_dept_processes_dept ON department_processes(department_id);

-- Department Documents (links to media)
CREATE TABLE department_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  media_id UUID REFERENCES media(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  document_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dept_docs_dept ON department_documents(department_id);
CREATE INDEX idx_dept_docs_media ON department_documents(media_id);

-- ============================================================
-- PART 2: EXPAND ROLES TABLE — Alias, Dynamic Authority
-- ============================================================

-- Add alias column to roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'alias') THEN
    ALTER TABLE roles ADD COLUMN alias VARCHAR(100);
  END IF;
END $$;

-- Make sure department_id FK exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_roles_department' AND table_name = 'roles'
  ) THEN
    ALTER TABLE roles ADD CONSTRAINT fk_roles_department
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_roles_department ON roles(department_id);
CREATE INDEX IF NOT EXISTS idx_roles_hierarchy ON roles(hierarchy_level);

-- ============================================================
-- PART 3: STAFF TABLE — Link to roles table dynamically
-- ============================================================

-- Add role_id FK so staff links to the roles table instead of free-text
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'role_id') THEN
    ALTER TABLE staff ADD COLUMN role_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'department_id') THEN
    ALTER TABLE staff ADD COLUMN department_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'is_active') THEN
    ALTER TABLE staff ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'deactivated_at') THEN
    ALTER TABLE staff ADD COLUMN deactivated_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'deactivation_reason') THEN
    ALTER TABLE staff ADD COLUMN deactivation_reason TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role_id);
CREATE INDEX IF NOT EXISTS idx_staff_department ON staff(department_id);
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff(is_active);
CREATE INDEX IF NOT EXISTS idx_staff_manager ON staff(manager_id);

-- ============================================================
-- PART 4: STAFF ACTION LOG (promotions, demotions, firing)
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  action_type VARCHAR(30) NOT NULL,
  previous_role_id UUID,
  new_role_id UUID,
  previous_role_name VARCHAR(255),
  new_role_name VARCHAR(255),
  previous_authority_level INTEGER,
  new_authority_level INTEGER,
  reason TEXT,
  requires_approval BOOLEAN DEFAULT false,
  approval_status VARCHAR(20) DEFAULT 'approved',
  approved_by UUID,
  performed_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_action_type CHECK (action_type IN ('promotion', 'demotion', 'termination', 'role_change', 'reactivation', 'hire'))
);

CREATE INDEX idx_staff_actions_staff ON staff_actions(staff_id);
CREATE INDEX idx_staff_actions_type ON staff_actions(action_type);
CREATE INDEX idx_staff_actions_date ON staff_actions(created_at DESC);

-- ============================================================
-- PART 5: SYSTEM BACKUPS
-- ============================================================

CREATE TABLE IF NOT EXISTS system_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT,
  cloudinary_public_id VARCHAR(500),
  file_size BIGINT DEFAULT 0,
  backup_type VARCHAR(30) DEFAULT 'full',
  status VARCHAR(20) DEFAULT 'completed',
  tags TEXT[] DEFAULT '{}',
  table_count INTEGER DEFAULT 0,
  row_count INTEGER DEFAULT 0,
  schema_version VARCHAR(20),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT backup_type_check CHECK (backup_type IN ('full', 'schema_only', 'data_only', 'incremental')),
  CONSTRAINT backup_status_check CHECK (status IN ('in_progress', 'completed', 'failed', 'uploaded'))
);

CREATE INDEX idx_backups_created ON system_backups(created_at DESC);
CREATE INDEX idx_backups_status ON system_backups(status);

-- Backup restoration log
CREATE TABLE IF NOT EXISTS backup_restorations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id UUID NOT NULL REFERENCES system_backups(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  requested_by UUID NOT NULL,
  approved_by UUID,
  tables_restored INTEGER DEFAULT 0,
  rows_restored INTEGER DEFAULT 0,
  error_message TEXT,
  log TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT restore_status_check CHECK (status IN ('pending', 'approved', 'in_progress', 'completed', 'failed', 'rejected'))
);

CREATE INDEX idx_restorations_backup ON backup_restorations(backup_id);

-- ============================================================
-- PART 6: OFFLINE QUEUE (for offline mode)
-- ============================================================

CREATE TABLE IF NOT EXISTS offline_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'queued',
  synced_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT queue_status_check CHECK (status IN ('queued', 'syncing', 'synced', 'failed'))
);

CREATE INDEX idx_offline_queue_user ON offline_queue(user_id);
CREATE INDEX idx_offline_queue_status ON offline_queue(status);

-- ============================================================
-- PART 7: MEDIA TABLE ENHANCEMENTS
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media' AND column_name = 'department_id') THEN
    ALTER TABLE media ADD COLUMN department_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media' AND column_name = 'category') THEN
    ALTER TABLE media ADD COLUMN category VARCHAR(50) DEFAULT 'general';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media' AND column_name = 'description') THEN
    ALTER TABLE media ADD COLUMN description TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_media_department ON media(department_id);
CREATE INDEX IF NOT EXISTS idx_media_entity ON media(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_media_category ON media(category);

-- ============================================================
-- PART 8: INSERT SEED DEPARTMENTS (5 of 7 — 2 omitted for testing)
-- ============================================================

INSERT INTO departments (name, description, alias) VALUES
(
  'Executive Leadership',
  'Guides the company toward long-term vision, ensures resources are used optimally, approves major actions, and monitors all departments. Responsibilities: Define company vision, allocate resources, make strategic decisions, manage major partnerships, oversee all departments, approve large expenses. Typical Roles: Founder/CEO, COO, CFO, CTO.',
  'C-Suite'
),
(
  'Product Engineering',
  'The department that creates the company''s core products and ensures their quality, scalability, and robustness. Responsibilities: Build, deploy, debug, and maintain all software systems (Drais, Lypha, RISE, Consty, Consty, Xhaira, Xheton). Design architecture, optimize performance, manage system integrations. Typical Roles: Software Engineer, System Architect, DevOps Engineer, QA Engineer, UI/UX Designer.',
  'Engineering'
),
(
  'Sales & Business Development',
  'Converts opportunities into revenue, maintains client relationships, and grows market presence. Responsibilities: Prospect clients, manage leads, close deals, handle partnerships, define pricing plans, track system licenses. Typical Roles: Sales Representative, Business Development Manager, Partnerships Manager.',
  'Sales'
),
(
  'Customer Success & Support',
  'Ensures clients succeed with the Consty platform, provides support, and maintains long-term relationships. Responsibilities: Onboard clients, provide training, resolve technical issues, maintain customer satisfaction, reduce churn. Typical Roles: Customer Success Manager, Support Engineer, Implementation Specialist.',
  'Support'
),
(
  'Finance & Accounting',
  'Protects the company financially and ensures resources are allocated wisely. Responsibilities: Track revenue, expenses, budgets, forecasting, and payroll. Integrate with Consty budgets, operations, and allocations. Typical Roles: CFO, Accountant, Financial Analyst.',
  'Finance'
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  alias = EXCLUDED.alias,
  updated_at = NOW();

-- ============================================================
-- PART 9: SEED ROLES LINKED TO DEPARTMENTS
-- ============================================================

-- Executive Leadership roles
INSERT INTO roles (name, description, hierarchy_level, is_system, department_id, alias) VALUES
  ('founder_ceo', 'Company Founder and CEO — full authority', 1, true,
    (SELECT id FROM departments WHERE name = 'Executive Leadership'), 'Emperor'),
  ('coo', 'Chief Operating Officer', 2, false,
    (SELECT id FROM departments WHERE name = 'Executive Leadership'), NULL),
  ('cfo', 'Chief Financial Officer', 2, false,
    (SELECT id FROM departments WHERE name = 'Executive Leadership'), NULL),
  ('cto', 'Chief Technology Officer', 2, false,
    (SELECT id FROM departments WHERE name = 'Executive Leadership'), NULL)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  hierarchy_level = EXCLUDED.hierarchy_level,
  department_id = EXCLUDED.department_id,
  alias = EXCLUDED.alias,
  updated_at = NOW();

-- Product Engineering roles
INSERT INTO roles (name, description, hierarchy_level, is_system, department_id, alias) VALUES
  ('software_engineer', 'Full-stack software engineer', 5, false,
    (SELECT id FROM departments WHERE name = 'Product Engineering'), NULL),
  ('system_architect', 'System architecture and design lead', 3, false,
    (SELECT id FROM departments WHERE name = 'Product Engineering'), NULL),
  ('devops_engineer', 'DevOps and infrastructure', 5, false,
    (SELECT id FROM departments WHERE name = 'Product Engineering'), NULL),
  ('qa_engineer', 'Quality assurance and testing', 5, false,
    (SELECT id FROM departments WHERE name = 'Product Engineering'), NULL),
  ('ui_ux_designer', 'User interface and experience design', 5, false,
    (SELECT id FROM departments WHERE name = 'Product Engineering'), NULL)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  hierarchy_level = EXCLUDED.hierarchy_level,
  department_id = EXCLUDED.department_id,
  updated_at = NOW();

-- Sales & BD roles
INSERT INTO roles (name, description, hierarchy_level, is_system, department_id) VALUES
  ('sales_representative', 'Sales and client acquisition', 5, false,
    (SELECT id FROM departments WHERE name = 'Sales & Business Development')),
  ('business_dev_manager', 'Business development and growth strategy', 4, false,
    (SELECT id FROM departments WHERE name = 'Sales & Business Development')),
  ('partnerships_manager', 'Partner relationship management', 4, false,
    (SELECT id FROM departments WHERE name = 'Sales & Business Development'))
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  hierarchy_level = EXCLUDED.hierarchy_level,
  department_id = EXCLUDED.department_id,
  updated_at = NOW();

-- Customer Success roles
INSERT INTO roles (name, description, hierarchy_level, is_system, department_id) VALUES
  ('customer_success_manager', 'Client success and retention', 4, false,
    (SELECT id FROM departments WHERE name = 'Customer Success & Support')),
  ('support_engineer', 'Technical support', 5, false,
    (SELECT id FROM departments WHERE name = 'Customer Success & Support')),
  ('implementation_specialist', 'System deployment and onboarding', 5, false,
    (SELECT id FROM departments WHERE name = 'Customer Success & Support'))
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  hierarchy_level = EXCLUDED.hierarchy_level,
  department_id = EXCLUDED.department_id,
  updated_at = NOW();

-- Finance roles
INSERT INTO roles (name, description, hierarchy_level, is_system, department_id) VALUES
  ('accountant', 'Financial record-keeping and reporting', 5, false,
    (SELECT id FROM departments WHERE name = 'Finance & Accounting')),
  ('financial_analyst', 'Financial analysis and forecasting', 4, false,
    (SELECT id FROM departments WHERE name = 'Finance & Accounting'))
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  hierarchy_level = EXCLUDED.hierarchy_level,
  department_id = EXCLUDED.department_id,
  updated_at = NOW();

-- Link roles to departments via department_roles
INSERT INTO department_roles (department_id, role_id, is_lead)
SELECT d.id, r.id,
  CASE WHEN r.name IN ('founder_ceo', 'system_architect', 'business_dev_manager', 'customer_success_manager', 'cfo') THEN true ELSE false END
FROM roles r
JOIN departments d ON r.department_id = d.id
ON CONFLICT (department_id, role_id) DO NOTHING;

-- ============================================================
-- PART 10: ADD NEW PERMISSIONS FOR DEPARTMENTS, BACKUPS, MEDIA
-- ============================================================

INSERT INTO permissions (module, action, description) VALUES
  ('departments', 'view', 'View departments'),
  ('departments', 'create', 'Create departments'),
  ('departments', 'edit', 'Edit departments'),
  ('departments', 'delete', 'Delete departments'),
  ('backups', 'view', 'View system backups'),
  ('backups', 'create', 'Create system backups'),
  ('backups', 'restore', 'Restore from backup'),
  ('backups', 'delete', 'Delete backups'),
  ('media', 'view', 'View media files'),
  ('media', 'upload', 'Upload media files'),
  ('media', 'delete', 'Delete media files'),
  ('staff_actions', 'promote', 'Promote staff members'),
  ('staff_actions', 'demote', 'Demote staff members'),
  ('staff_actions', 'terminate', 'Terminate staff members')
ON CONFLICT (module, action) DO NOTHING;

-- Grant all new permissions to superadmin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'superadmin'
  AND p.module IN ('departments', 'backups', 'media', 'staff_actions')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant view permissions to admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND ((p.module = 'departments' AND p.action IN ('view', 'create', 'edit'))
    OR (p.module = 'backups' AND p.action = 'view')
    OR (p.module = 'media')
    OR (p.module = 'staff_actions' AND p.action IN ('promote', 'demote')))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================
-- DONE
-- ============================================================
