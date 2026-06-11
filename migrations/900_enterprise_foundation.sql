-- ============================================================
-- MIGRATION 900: Enterprise Foundation — Ownership, Comments,
-- Decision Logs, Issue Intelligence, SSE, Notifications Enhancement
-- Consty Operating System
-- ============================================================

-- ============================================================
-- PART 1: RECORD OWNERSHIP — Track who created/modified every record
-- ============================================================

-- Add ownership columns to core tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'systems', 'deals', 'payments', 'licenses', 'prospects', 'clients',
    'invoices', 'allocations', 'obligations', 'services', 'products',
    'knowledge_articles', 'bug_reports', 'feature_requests'
  ])
  LOOP
    -- created_by_user_id
    BEGIN
      EXECUTE format('ALTER TABLE %I ADD COLUMN created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL', tbl);
    EXCEPTION WHEN duplicate_column THEN NULL;
    END;
    -- last_modified_by_user_id
    BEGIN
      EXECUTE format('ALTER TABLE %I ADD COLUMN last_modified_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL', tbl);
    EXCEPTION WHEN duplicate_column THEN NULL;
    END;
    -- last_modified_at
    BEGIN
      EXECUTE format('ALTER TABLE %I ADD COLUMN last_modified_at TIMESTAMPTZ', tbl);
    EXCEPTION WHEN duplicate_column THEN NULL;
    END;
  END LOOP;
END $$;

-- Indexes for ownership lookups
CREATE INDEX IF NOT EXISTS idx_systems_created_by ON systems(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_deals_created_by ON deals(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_by ON payments(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_prospects_created_by ON prospects(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by_user_id);

-- ============================================================
-- PART 2: RECORD COMMENTS — Threaded commenting on any entity
-- ============================================================

CREATE TABLE IF NOT EXISTS record_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,        -- 'deal', 'prospect', 'system', 'invoice', etc.
  entity_id UUID NOT NULL,
  parent_comment_id UUID REFERENCES record_comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_edited BOOLEAN NOT NULL DEFAULT false,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  mentions UUID[],                         -- user IDs mentioned
  attachments JSONB DEFAULT '[]',          -- [{url, name, type}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_entity ON record_comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON record_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON record_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON record_comments(created_at DESC);

-- ============================================================
-- PART 3: DECISION LOG — Track key decisions with context
-- ============================================================

CREATE TABLE IF NOT EXISTS decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(30) NOT NULL DEFAULT 'decided',
  decision_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Context
  context TEXT,                              -- Background/reasoning
  alternatives TEXT,                         -- What else was considered
  consequences TEXT,                         -- Expected impact
  stakeholders UUID[],                       -- User IDs involved

  -- Links
  related_entity_type VARCHAR(50),
  related_entity_id UUID,

  -- Tracking
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  review_date DATE,
  review_notes TEXT,

  -- Metadata
  tags TEXT[],
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT dl_category_check CHECK (category IN ('general', 'technical', 'financial', 'operational', 'strategic', 'hiring', 'product', 'legal')),
  CONSTRAINT dl_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT dl_status_check CHECK (status IN ('proposed', 'under_review', 'decided', 'implemented', 'reversed', 'deferred'))
);

CREATE INDEX IF NOT EXISTS idx_decision_logs_category ON decision_logs(category);
CREATE INDEX IF NOT EXISTS idx_decision_logs_status ON decision_logs(status);
CREATE INDEX IF NOT EXISTS idx_decision_logs_date ON decision_logs(decision_date DESC);
CREATE INDEX IF NOT EXISTS idx_decision_logs_decided_by ON decision_logs(decided_by);
CREATE INDEX IF NOT EXISTS idx_decision_logs_dept ON decision_logs(department_id);

-- ============================================================
-- PART 4: ISSUE INTELLIGENCE — Root cause & resolution tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS issue_root_causes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_report_id UUID REFERENCES bug_reports(id) ON DELETE CASCADE,
  root_cause TEXT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'unknown',
  identified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  identified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prevention_strategy TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT irc_category_check CHECK (category IN (
    'code_bug', 'design_flaw', 'missing_validation', 'integration',
    'performance', 'security', 'configuration', 'data_issue',
    'third_party', 'infrastructure', 'unknown'
  ))
);

CREATE INDEX IF NOT EXISTS idx_root_causes_bug ON issue_root_causes(bug_report_id);
CREATE INDEX IF NOT EXISTS idx_root_causes_category ON issue_root_causes(category);

CREATE TABLE IF NOT EXISTS issue_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_report_id UUID REFERENCES bug_reports(id) ON DELETE CASCADE,
  resolution_type VARCHAR(50) NOT NULL DEFAULT 'fix',
  description TEXT NOT NULL,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_to_resolve_hours NUMERIC(10, 2),
  files_changed TEXT[],
  verification_steps TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ir_type_check CHECK (resolution_type IN ('fix', 'workaround', 'wont_fix', 'duplicate', 'by_design', 'config_change'))
);

CREATE INDEX IF NOT EXISTS idx_resolutions_bug ON issue_resolutions(bug_report_id);
CREATE INDEX IF NOT EXISTS idx_resolutions_type ON issue_resolutions(resolution_type);

-- ============================================================
-- PART 5: NOTIFICATION ENHANCEMENTS — Priority & action URLs
-- ============================================================

DO $$
BEGIN
  ALTER TABLE notifications ADD COLUMN priority VARCHAR(20) DEFAULT 'normal';
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE notifications ADD COLUMN action_url TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE notifications ADD COLUMN category VARCHAR(50);
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- PART 6: SSE / REAL-TIME — PG NOTIFY trigger for notifications
-- ============================================================

-- Notification function: fires PG NOTIFY on insert
CREATE OR REPLACE FUNCTION notify_new_notification()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('new_notification', json_build_object(
    'id', NEW.id,
    'recipient_user_id', NEW.recipient_user_id,
    'type', NEW.type,
    'title', NEW.title,
    'message', NEW.message,
    'reference_type', NEW.reference_type,
    'reference_id', NEW.reference_id,
    'priority', NEW.priority,
    'action_url', NEW.action_url,
    'created_at', NEW.created_at
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_notification_insert ON notifications;
CREATE TRIGGER trg_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_notification();

-- ============================================================
-- PART 7: INTELLIGENCE VIEWS
-- ============================================================

-- Bug resolution metrics view
CREATE OR REPLACE VIEW v_bug_resolution_metrics AS
SELECT
  br.id as bug_id,
  br.title,
  br.severity,
  br.status,
  br.created_at as reported_at,
  irc.category as root_cause_category,
  irc.root_cause,
  ir.resolution_type,
  ir.time_to_resolve_hours,
  ir.is_verified,
  ir.resolved_at
FROM bug_reports br
LEFT JOIN issue_root_causes irc ON irc.bug_report_id = br.id
LEFT JOIN issue_resolutions ir ON ir.bug_report_id = br.id;

-- Decision log overview
CREATE OR REPLACE VIEW v_decision_overview AS
SELECT
  dl.*,
  u.name as decided_by_name,
  d.name as department_name,
  (SELECT COUNT(*) FROM record_comments rc WHERE rc.entity_type = 'decision_log' AND rc.entity_id = dl.id) as comment_count
FROM decision_logs dl
LEFT JOIN users u ON dl.decided_by = u.id
LEFT JOIN departments d ON dl.department_id = d.id;

-- ============================================================
-- PART 8: PERMISSIONS for new modules
-- ============================================================

INSERT INTO permissions (module, action, description) VALUES
  ('comments', 'view', 'View record comments'),
  ('comments', 'create', 'Create comments on records'),
  ('comments', 'edit', 'Edit own comments'),
  ('comments', 'delete', 'Delete comments'),
  ('comments', 'resolve', 'Resolve comment threads'),
  ('decision_logs', 'view', 'View decision log'),
  ('decision_logs', 'create', 'Create decision entries'),
  ('decision_logs', 'edit', 'Edit decision entries'),
  ('decision_logs', 'delete', 'Delete decision entries'),
  ('issue_intelligence', 'view', 'View issue root causes & resolutions'),
  ('issue_intelligence', 'create', 'Create root cause analysis or resolution'),
  ('issue_intelligence', 'edit', 'Edit root cause or resolution entries')
ON CONFLICT DO NOTHING;

-- Grant all new permissions to superadmin and admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('superadmin', 'admin')
  AND p.module IN ('comments', 'decision_logs', 'issue_intelligence')
ON CONFLICT DO NOTHING;
