-- 0007_quality_risk_issues.sql
-- Quality control (checklists, inspections, defects) + project risk & issue
-- management. project_issues is DISTINCT from the inherited software `system_issues`.

CREATE TABLE IF NOT EXISTS inspection_checklists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,  -- NULL = reusable template
  name        text NOT NULL,
  description text,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inspection_checklist_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES inspection_checklists(id) ON DELETE CASCADE,
  label        text NOT NULL,
  is_required  boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_checklist_items_list ON inspection_checklist_items(checklist_id);

CREATE TABLE IF NOT EXISTS inspections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_item_id uuid REFERENCES work_items(id) ON DELETE SET NULL,
  checklist_id uuid REFERENCES inspection_checklists(id) ON DELETE SET NULL,
  inspector_id uuid REFERENCES users(id) ON DELETE SET NULL,
  result       text NOT NULL DEFAULT 'pending'
                 CHECK (result IN ('pending','pass','fail','conditional')),
  notes        text,
  performed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inspections_project ON inspections(project_id);

CREATE TABLE IF NOT EXISTS defects (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_item_id   uuid REFERENCES work_items(id) ON DELETE SET NULL,
  inspection_id  uuid REFERENCES inspections(id) ON DELETE SET NULL,
  description    text NOT NULL,
  severity       text NOT NULL DEFAULT 'medium'
                   CHECK (severity IN ('low','medium','high','critical')),
  rework_required boolean NOT NULL DEFAULT false,
  status         text NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','in_rework','closed')),
  assigned_to    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_defects_project ON defects(project_id);
CREATE INDEX IF NOT EXISTS idx_defects_status  ON defects(project_id, status);

-- Risk = possible future problem (probability × impact).
CREATE TABLE IF NOT EXISTS risks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description     text NOT NULL,
  probability     integer NOT NULL DEFAULT 3 CHECK (probability BETWEEN 1 AND 5),
  impact          integer NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  score           integer GENERATED ALWAYS AS (probability * impact) STORED,
  mitigation_plan text,
  owner_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','mitigating','closed','materialized')),
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_risks_project ON risks(project_id);

-- Issue = current active problem.
CREATE TABLE IF NOT EXISTS project_issues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description     text NOT NULL,
  current_impact  text,
  owner_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  resolution_plan text,
  due_date        date,
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','in_progress','resolved')),
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_issues_project ON project_issues(project_id);
