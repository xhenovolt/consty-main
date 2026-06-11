/**
 * Migration 302 — Unified Items + Knowledge Base + Client Obligations + Pipeline Intelligence
 *
 * ARCHITECTURE REDESIGN:
 * 1. Merge assets + resources → unified items table (single source of truth)
 * 2. Add knowledge_assets for intellectual property documentation
 * 3. Add client_obligations for post-deal deliverable tracking
 * 4. Add pipeline_stages, pipeline_entries, pipeline_stage_history for sales intelligence
 * 5. Add item_activity_log for item lifecycle tracking
 * 6. Add obligation_templates for standard deliverables per system
 *
 * CORE PRINCIPLE: Every real-world object exists once in the database.
 */

-- ============================================================================
-- 1. UNIFIED ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Classification
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'hardware', 'clothing', 'infrastructure', 'transport',
    'office_equipment', 'branding_material', 'software', 'other'
  )),
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'development_tool', 'sales_tool', 'infrastructure',
    'equipment', 'branding', 'transport', 'other'
  )),
  financial_class VARCHAR(30) NOT NULL DEFAULT 'asset' CHECK (financial_class IN (
    'asset', 'operational_asset', 'expense_item'
  )),

  -- Financial
  purchase_cost NUMERIC(15,2),
  current_value NUMERIC(15,2),
  currency VARCHAR(10) DEFAULT 'UGX',

  -- Dates
  acquisition_date DATE,

  -- Assignment & Linkage
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  linked_system UUID REFERENCES systems(id) ON DELETE SET NULL,

  -- Revenue analysis
  revenue_dependency BOOLEAN DEFAULT false,

  -- Status & condition
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'retired', 'lost', 'damaged', 'maintenance')),
  condition VARCHAR(20) DEFAULT 'good' CHECK (condition IN ('new', 'good', 'fair', 'poor', 'damaged')),

  -- Infrastructure-specific
  provider VARCHAR(255),
  renewal_date DATE,

  -- Hardware-specific
  serial_number VARCHAR(255),
  location VARCHAR(255),

  -- Legacy tracking
  is_historical BOOLEAN DEFAULT false,
  account_deducted_from UUID REFERENCES accounts(id) ON DELETE SET NULL,
  ledger_entry_id UUID REFERENCES ledger(id) ON DELETE SET NULL,
  migrated_from_asset UUID,
  migrated_from_resource UUID,

  -- Notes
  notes TEXT,
  usage_notes TEXT,

  -- Tracking
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_financial_class ON items(financial_class);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_assigned_to ON items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_items_linked_system ON items(linked_system);
CREATE INDEX IF NOT EXISTS idx_items_revenue_dependency ON items(revenue_dependency) WHERE revenue_dependency = true;
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC);

-- ============================================================================
-- 2. ITEM ACTIVITY LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS item_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('created','edited','assigned','status_changed','retired','restored')),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_activity_item ON item_activity_log(item_id);
CREATE INDEX IF NOT EXISTS idx_item_activity_action ON item_activity_log(action);

-- ============================================================================
-- 3. MIGRATE DATA: assets → items
-- ============================================================================

INSERT INTO items (
  name, description, category, type, financial_class,
  purchase_cost, current_value, currency, acquisition_date,
  status, condition, serial_number, location,
  is_historical, account_deducted_from, ledger_entry_id,
  notes, created_by, created_at, updated_at,
  migrated_from_asset
)
SELECT
  a.name,
  a.description,
  -- Map asset_type → category
  CASE
    WHEN a.asset_type IN ('equipment','furniture') THEN 'hardware'
    WHEN a.asset_type = 'vehicle' THEN 'transport'
    WHEN a.asset_type IN ('software','domain') THEN 'software'
    WHEN a.asset_type = 'infrastructure' THEN 'infrastructure'
    WHEN a.asset_type = 'ip' THEN 'software'
    ELSE 'other'
  END,
  -- Map asset_type → type
  CASE
    WHEN a.asset_type IN ('equipment','software','domain','ip') THEN 'development_tool'
    WHEN a.asset_type = 'infrastructure' THEN 'infrastructure'
    WHEN a.asset_type = 'vehicle' THEN 'transport'
    WHEN a.asset_type = 'furniture' THEN 'equipment'
    ELSE 'other'
  END,
  'asset',
  COALESCE(a.cost, a.value),
  COALESCE(a.current_value, a.cost, a.value),
  COALESCE(a.currency, 'UGX'),
  a.acquisition_date,
  COALESCE(CASE WHEN a.condition = 'damaged' THEN 'damaged' ELSE 'active' END, 'active'),
  COALESCE(a.condition, 'good'),
  a.serial_number,
  a.location,
  COALESCE(a.is_historical, false),
  a.account_deducted_from,
  a.ledger_entry_id,
  a.notes,
  a.created_by,
  a.created_at,
  COALESCE(a.updated_at, a.created_at),
  a.id
FROM assets a
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. MIGRATE DATA: resources → items (skip duplicates by name similarity)
-- ============================================================================

INSERT INTO items (
  name, description, category, type, financial_class,
  purchase_cost, currency, acquisition_date,
  assigned_to, status, condition,
  provider, renewal_date, serial_number,
  notes, usage_notes, created_by, created_at, updated_at,
  migrated_from_resource
)
SELECT
  r.name,
  r.description,
  -- Map category
  CASE
    WHEN r.category = 'hardware' THEN 'hardware'
    WHEN r.category = 'infrastructure' THEN 'infrastructure'
    WHEN r.category = 'business_tool' THEN 'other'
    ELSE 'other'
  END,
  -- Map type
  CASE
    WHEN r.category = 'hardware' THEN 'development_tool'
    WHEN r.category = 'infrastructure' THEN 'infrastructure'
    WHEN r.category = 'business_tool' THEN 'sales_tool'
    ELSE 'other'
  END,
  CASE
    WHEN r.category = 'infrastructure' THEN 'operational_asset'
    ELSE 'asset'
  END,
  r.cost,
  COALESCE(r.currency, 'UGX'),
  r.acquisition_date,
  r.assigned_to,
  CASE
    WHEN r.status IN ('active','retired','maintenance') THEN r.status
    WHEN r.status = 'inactive' THEN 'retired'
    WHEN r.status = 'pending' THEN 'active'
    ELSE 'active'
  END,
  'good',
  r.provider,
  r.renewal_date,
  r.serial_number,
  r.notes,
  r.usage_notes,
  r.created_by,
  r.created_at,
  COALESCE(r.updated_at, r.created_at),
  r.id
FROM resources r
-- Skip resources that are likely duplicates of already-migrated assets
-- Match by: same cost+currency, or very similar name
WHERE NOT EXISTS (
  SELECT 1 FROM items i
  WHERE i.migrated_from_asset IS NOT NULL
    AND (
      -- Same cost and currency = likely same item
      (i.purchase_cost IS NOT NULL AND i.purchase_cost = r.cost AND i.currency = COALESCE(r.currency, 'UGX'))
      -- Or name contains the other (case-insensitive)
      OR LOWER(TRIM(i.name)) LIKE '%' || LOWER(TRIM(SUBSTRING(r.name FROM 1 FOR 10))) || '%'
    )
);

-- ============================================================================
-- 5. KNOWLEDGE ASSETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'system_architecture', 'deployment_guide', 'sales_playbook',
    'support_documentation', 'development_notes', 'infrastructure',
    'feature_documentation', 'development_standards', 'other'
  )),
  system_id UUID REFERENCES systems(id) ON DELETE SET NULL,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  visibility VARCHAR(20) NOT NULL DEFAULT 'internal' CHECK (visibility IN ('private', 'internal', 'public')),
  content TEXT,
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_assets(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_system ON knowledge_assets(system_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_assets(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_visibility ON knowledge_assets(visibility);
CREATE INDEX IF NOT EXISTS idx_knowledge_author ON knowledge_assets(author_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_title ON knowledge_assets USING gin(to_tsvector('english', title));

-- Knowledge version history
CREATE TABLE IF NOT EXISTS knowledge_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID NOT NULL REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  version INT NOT NULL,
  content TEXT,
  edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_versions_kid ON knowledge_versions(knowledge_id);

-- ============================================================================
-- 6. CLIENT OBLIGATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  system_id UUID REFERENCES systems(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obligations_deal ON client_obligations(deal_id);
CREATE INDEX IF NOT EXISTS idx_obligations_client ON client_obligations(client_id);
CREATE INDEX IF NOT EXISTS idx_obligations_system ON client_obligations(system_id);
CREATE INDEX IF NOT EXISTS idx_obligations_status ON client_obligations(status);
CREATE INDEX IF NOT EXISTS idx_obligations_priority ON client_obligations(priority);
CREATE INDEX IF NOT EXISTS idx_obligations_assigned ON client_obligations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_obligations_due ON client_obligations(due_date) WHERE status NOT IN ('completed');

-- Obligation Templates (per system)
CREATE TABLE IF NOT EXISTS obligation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID REFERENCES systems(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  default_priority VARCHAR(20) DEFAULT 'medium',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obligation_templates_system ON obligation_templates(system_id);

-- ============================================================================
-- 7. PIPELINE INTELLIGENCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  stage_order INT NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default pipeline stages
INSERT INTO pipeline_stages (name, stage_order, description, color) VALUES
  ('Prospect Identified', 1, 'Initial identification of potential client', '#94a3b8'),
  ('Contact Established', 2, 'First meaningful communication made', '#3b82f6'),
  ('Meeting Scheduled', 3, 'Meeting or call arranged', '#8b5cf6'),
  ('Product Demonstration', 4, 'System demo delivered', '#f59e0b'),
  ('Negotiation', 5, 'Price and terms being negotiated', '#ef4444'),
  ('Deal Closed', 6, 'Deal signed and payment started', '#22c55e'),
  ('Deployment', 7, 'System being installed/deployed', '#06b6d4')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS pipeline_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  current_stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  system_id UUID REFERENCES systems(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  expected_value NUMERIC(15,2),
  expected_close_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_entries_prospect ON pipeline_entries(prospect_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_entries_stage ON pipeline_entries(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_entries_system ON pipeline_entries(system_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_entries_assigned ON pipeline_entries(assigned_to);

CREATE TABLE IF NOT EXISTS pipeline_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_entry_id UUID NOT NULL REFERENCES pipeline_entries(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pipe_history_entry ON pipeline_stage_history(pipeline_entry_id);
CREATE INDEX IF NOT EXISTS idx_pipe_history_stage ON pipeline_stage_history(stage_id);

-- ============================================================================
-- 8. SEED OBLIGATION TEMPLATES FOR KNOWN SYSTEMS
-- ============================================================================

-- Drais templates
INSERT INTO obligation_templates (system_id, title, description, default_priority, sort_order)
SELECT s.id, t.title, t.description, t.priority, t.sort_order
FROM systems s
CROSS JOIN (VALUES
  ('Install system on client server', 'Setup and deploy Drais on production', 'critical', 1),
  ('Configure classes and subjects', 'Set up school structure', 'high', 2),
  ('Configure teacher accounts', 'Create teacher login credentials', 'high', 3),
  ('Configure student records', 'Import/enter student data', 'high', 4),
  ('Train school staff', 'Conduct training sessions', 'high', 5),
  ('Setup reports module', 'Configure report cards and analytics', 'medium', 6),
  ('Install fingerprint device', 'Setup biometric attendance hardware', 'medium', 7)
) AS t(title, description, priority, sort_order)
WHERE s.name = 'Drais'
ON CONFLICT DO NOTHING;

-- Generic templates for other systems
INSERT INTO obligation_templates (system_id, title, description, default_priority, sort_order)
SELECT s.id, t.title, t.description, t.priority, t.sort_order
FROM systems s
CROSS JOIN (VALUES
  ('Install and configure system', 'Deploy system in client environment', 'critical', 1),
  ('Create user accounts', 'Set up admin and user access', 'high', 2),
  ('Data migration', 'Import existing client data if applicable', 'medium', 3),
  ('Staff training', 'Train client staff on system usage', 'high', 4),
  ('Post-deployment support', '30-day support after go-live', 'medium', 5)
) AS t(title, description, priority, sort_order)
WHERE s.name != 'Drais' AND s.name != 'Consty'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 9. RENAME OLD TABLES (soft deprecation)
-- ============================================================================

-- We don't DROP the old tables to preserve data integrity during transition.
-- Instead, rename them to signal deprecation.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assets' AND table_schema = 'public') THEN
    ALTER TABLE assets RENAME TO _deprecated_assets;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resources' AND table_schema = 'public') THEN
    ALTER TABLE resources RENAME TO _deprecated_resources;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================================
-- DONE
-- ============================================================================
