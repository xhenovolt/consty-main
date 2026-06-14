-- 0006_blockers_change_orders.sql
-- Blocker / stalling diagnosis + change orders.
-- Blockers explain WHY a project is stalled (manual now; auto-diagnosis engine
-- in Phase 6). Change orders reuse the approval_requests engine.

CREATE TABLE IF NOT EXISTS blockers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_type        text NOT NULL DEFAULT 'work_item'
                       CHECK (target_type IN ('project','work_item','resource','procurement','budget')),
  target_id          uuid,                       -- polymorphic; validated in app
  blocker_type       text NOT NULL
                       CHECK (blocker_type IN ('missing_budget','missing_material','missing_sister_material',
                              'unavailable_labour','unavailable_equipment','transport_delay','supplier_delay',
                              'approval_delay','client_delay','design_document_issue','weather_external',
                              'quality_defect','rework_required','scope_change','unclear_responsibility')),
  description        text,
  responsible_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  required_action    text,
  est_delay_days     integer CHECK (est_delay_days IS NULL OR est_delay_days >= 0),
  est_cost_impact    numeric(18,2),
  severity           text NOT NULL DEFAULT 'medium'
                       CHECK (severity IN ('low','medium','high','critical')),
  detected_by        text NOT NULL DEFAULT 'manual' CHECK (detected_by IN ('manual','auto')),
  status             text NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open','in_progress','resolved')),
  resolution_notes   text,
  created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  detected_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blockers_project ON blockers(project_id);
CREATE INDEX IF NOT EXISTS idx_blockers_status  ON blockers(project_id, status);
CREATE INDEX IF NOT EXISTS idx_blockers_target  ON blockers(target_type, target_id);

CREATE TABLE IF NOT EXISTS change_orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title                text NOT NULL,
  reason               text,
  original_scope       text,
  requested_change     text,
  cost_impact          numeric(18,2) NOT NULL DEFAULT 0,
  time_impact_days     integer NOT NULL DEFAULT 0,
  status               text NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','submitted','approved','rejected')),
  approval_request_id  uuid REFERENCES approval_requests(id) ON DELETE SET NULL,
  budget_line_id       uuid REFERENCES budget_lines(id) ON DELETE SET NULL,
  schedule_adjustment  jsonb,
  requested_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_change_orders_project ON change_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_status  ON change_orders(project_id, status);
