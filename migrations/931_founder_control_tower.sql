-- ============================================================================
-- Migration 931: Founder Control Tower & Organizational Authority Engine
-- Date: 2026-03-15
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. AUTHORITY_LEVELS TABLE — Fully customizable authority tiers
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS authority_levels (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name varchar(100) NOT NULL UNIQUE,
  description text,
  rank_value integer NOT NULL DEFAULT 0,
  color_indicator varchar(20) DEFAULT '#3b82f6',
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_authority_levels_rank ON authority_levels (rank_value DESC);
CREATE INDEX IF NOT EXISTS idx_authority_levels_active ON authority_levels (is_active) WHERE is_active = true;

-- Seed default authority levels
INSERT INTO authority_levels (name, description, rank_value, color_indicator) VALUES
  ('Founder',    'Company founder — ultimate authority',        100, '#dc2626'),
  ('Executive',  'C-suite executive leadership',                 80, '#7c3aed'),
  ('Director',   'Department or division director',              60, '#2563eb'),
  ('Manager',    'Team or project manager',                      40, '#0891b2'),
  ('Supervisor', 'Team supervisor / senior staff',               30, '#059669'),
  ('Staff',      'Standard operational staff',                   20, '#6b7280'),
  ('Intern',     'Intern or trainee — limited authority',        10, '#9ca3af')
ON CONFLICT (name) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. ORGANIZATIONAL_STRUCTURE TABLE — Company tree
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizational_structure (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  node_name varchar(200) NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  authority_level_id uuid REFERENCES authority_levels(id) ON DELETE SET NULL,
  reports_to_node_id uuid REFERENCES organizational_structure(id) ON DELETE SET NULL,
  hierarchy_depth integer DEFAULT 0,
  staff_assigned_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  title_alias varchar(200),
  status varchar(20) DEFAULT 'active' CHECK (status IN ('active','vacant','suspended','archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_structure_parent ON organizational_structure (reports_to_node_id);
CREATE INDEX IF NOT EXISTS idx_org_structure_dept ON organizational_structure (department_id);
CREATE INDEX IF NOT EXISTS idx_org_structure_staff ON organizational_structure (staff_assigned_id);
CREATE INDEX IF NOT EXISTS idx_org_structure_authority ON organizational_structure (authority_level_id);
CREATE INDEX IF NOT EXISTS idx_org_structure_status ON organizational_structure (status) WHERE status = 'active';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. ORG_CHANGE_LOGS TABLE — Every structural change is recorded
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_change_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  changed_by uuid REFERENCES users(id),
  change_type varchar(50) NOT NULL,
  entity_type varchar(50) NOT NULL,
  entity_id uuid,
  old_structure jsonb,
  new_structure jsonb,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_change_logs_entity ON org_change_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_org_change_logs_time ON org_change_logs (created_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. ENHANCE APPROVAL_REQUESTS — Add authority level routing
-- ────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='approval_requests' AND column_name='required_authority_rank') THEN
    ALTER TABLE approval_requests ADD COLUMN required_authority_rank integer DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='approval_requests' AND column_name='current_authority_rank') THEN
    ALTER TABLE approval_requests ADD COLUMN current_authority_rank integer DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='approval_requests' AND column_name='escalation_path') THEN
    ALTER TABLE approval_requests ADD COLUMN escalation_path jsonb DEFAULT '[]';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='approval_requests' AND column_name='category') THEN
    ALTER TABLE approval_requests ADD COLUMN category varchar(50);
  END IF;
END $$;

COMMIT;
