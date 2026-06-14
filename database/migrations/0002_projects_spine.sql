-- 0002_projects_spine.sql
-- CONSTY Phase 1 — Projects Spine.
-- Real projects + governance + per-project membership + Work Breakdown Structure
-- (stages → milestones → work_packages → tasks → subtasks) + dependencies,
-- with progress rollup and a project-health stub.
-- Single-tenant (no org_id). All constraints enforced at the database.

-- ───────────────────────────── PROJECTS ─────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  name          text NOT NULL,
  description   text,
  category      text,
  type          text NOT NULL DEFAULT 'construction'
                  CHECK (type IN ('construction','infrastructure','field_ops','fitout',
                                  'maintenance','consultancy','other')),
  governor_id   uuid REFERENCES users(id) ON DELETE SET NULL,   -- sponsor / accountable
  manager_id    uuid REFERENCES users(id) ON DELETE SET NULL,   -- delivery owner
  client_id     uuid REFERENCES clients(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','planning','approved','active',
                                    'on_hold','frozen','closing','closed','cancelled')),
  health        text NOT NULL DEFAULT 'green' CHECK (health IN ('green','amber','red')),
  priority      text NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high','critical')),
  currency      text NOT NULL DEFAULT 'UGX',
  location      text,
  planned_start date,
  planned_end   date,
  actual_start  date,
  actual_end    date,
  progress_pct  numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  budget_status text CHECK (budget_status IN ('surplus','balanced','tight','deficit','frozen','overrun')),
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_status   ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_manager  ON projects(manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_governor ON projects(governor_id);
CREATE INDEX IF NOT EXISTS idx_projects_client   ON projects(client_id);

-- ──────────────────────────── WORK ITEMS ────────────────────────────
-- One tree covers stage/milestone/work_package/task/subtask. parent_id builds
-- the hierarchy; progress rolls upward via fn_rollup_project().
CREATE TABLE IF NOT EXISTS work_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type            text NOT NULL
                    CHECK (type IN ('stage','milestone','work_package','task','subtask')),
  parent_id       uuid REFERENCES work_items(id) ON DELETE CASCADE,
  sequence        integer NOT NULL DEFAULT 0,
  name            text NOT NULL,
  description     text,
  owner_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'not_started'
                    CHECK (status IN ('not_started','in_progress','blocked','in_review','done','cancelled')),
  priority        text NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high','critical')),
  planned_start   date,
  planned_end     date,
  actual_start    date,
  actual_end      date,
  progress_pct    numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  weight          numeric NOT NULL DEFAULT 1 CHECK (weight > 0),
  is_gate         boolean NOT NULL DEFAULT false,
  budget_amount   numeric(18,2),
  completion_notes text,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_items_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX IF NOT EXISTS idx_work_items_project ON work_items(project_id);
CREATE INDEX IF NOT EXISTS idx_work_items_parent  ON work_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_work_items_type    ON work_items(project_id, type);
CREATE INDEX IF NOT EXISTS idx_work_items_owner   ON work_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_work_items_status  ON work_items(project_id, status);

-- ──────────────────────── WORK ITEM DEPENDENCIES ────────────────────
CREATE TABLE IF NOT EXISTS work_item_dependencies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predecessor_id  uuid NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  successor_id    uuid NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  dep_type        text NOT NULL DEFAULT 'FS' CHECK (dep_type IN ('FS','SS','FF','SF')),
  lag_days        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_item_dep_not_self CHECK (predecessor_id <> successor_id),
  CONSTRAINT work_item_dep_unique UNIQUE (predecessor_id, successor_id)
);
CREATE INDEX IF NOT EXISTS idx_wid_predecessor ON work_item_dependencies(predecessor_id);
CREATE INDEX IF NOT EXISTS idx_wid_successor   ON work_item_dependencies(successor_id);

-- ─────────────────────────── PROJECT MEMBERS ────────────────────────
-- Per-project RBAC. Access rule (enforced in app): superadmin/admin bypass;
-- otherwise a row here is required and project_role governs in-project actions.
CREATE TABLE IF NOT EXISTS project_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_role  text NOT NULL
                  CHECK (project_role IN ('governor','manager','stage_leader','contributor',
                                          'viewer','contractor','client','accountant',
                                          'procurement_officer','storekeeper','inspector','field_worker')),
  stage_id      uuid REFERENCES work_items(id) ON DELETE SET NULL,  -- for stage_leader scope
  permissions   jsonb,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_members_unique UNIQUE (project_id, user_id, project_role)
);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user    ON project_members(user_id);

-- ───────────────────────── PROGRESS ROLLUP ──────────────────────────
-- Recomputes branch-node progress from children (deepest level first), then the
-- project. Leaf nodes keep their manually-entered progress. Called by the app
-- after task/work-item mutations (no triggers, to avoid recursive re-entry).
CREATE OR REPLACE FUNCTION fn_rollup_project(p_project uuid) RETURNS void AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    WITH RECURSIVE tree AS (
      SELECT id, parent_id, 0 AS depth
        FROM work_items WHERE project_id = p_project AND parent_id IS NULL
      UNION ALL
      SELECT wi.id, wi.parent_id, t.depth + 1
        FROM work_items wi JOIN tree t ON wi.parent_id = t.id
    )
    SELECT id FROM tree ORDER BY depth DESC
  LOOP
    UPDATE work_items b
       SET progress_pct = COALESCE((
             SELECT round(SUM(c.progress_pct * c.weight) / NULLIF(SUM(c.weight), 0), 2)
               FROM work_items c WHERE c.parent_id = b.id
           ), b.progress_pct),
           updated_at = now()
     WHERE b.id = r.id
       AND EXISTS (SELECT 1 FROM work_items c WHERE c.parent_id = b.id);
  END LOOP;

  UPDATE projects p
     SET progress_pct = COALESCE((
           SELECT round(SUM(wi.progress_pct * wi.weight) / NULLIF(SUM(wi.weight), 0), 2)
             FROM work_items wi
            WHERE wi.project_id = p_project AND wi.parent_id IS NULL
         ), 0),
         updated_at = now()
   WHERE p.id = p_project;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────── PROJECT HEALTH (STUB) ────────────────────
-- Phase-1 heuristic; replaced by the full composite model in Phase 7.
--   red   : past planned_end and not complete, or status frozen/on_hold
--   amber : active but no progress, or planned_end within 7 days and < 80%
--   green : otherwise
CREATE OR REPLACE FUNCTION fn_project_health(p_project uuid) RETURNS text AS $$
DECLARE v projects%ROWTYPE; v_health text := 'green';
BEGIN
  SELECT * INTO v FROM projects WHERE id = p_project;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v.status IN ('frozen','on_hold')
     OR (v.planned_end IS NOT NULL AND v.planned_end < CURRENT_DATE AND v.progress_pct < 100) THEN
    v_health := 'red';
  ELSIF (v.status = 'active' AND v.progress_pct = 0)
     OR (v.planned_end IS NOT NULL AND v.planned_end <= CURRENT_DATE + 7 AND v.progress_pct < 80) THEN
    v_health := 'amber';
  END IF;

  UPDATE projects SET health = v_health, updated_at = now() WHERE id = p_project;
  RETURN v_health;
END;
$$ LANGUAGE plpgsql;
