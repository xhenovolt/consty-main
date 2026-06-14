-- 0008_closure.sql
-- Project closure / handover: final inspection, cost summary, returns/waste,
-- client acceptance, handover document, lessons learned, profit/loss result.

CREATE TABLE IF NOT EXISTS project_closures (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  final_inspection_id  uuid REFERENCES inspections(id) ON DELETE SET NULL,
  final_cost           numeric(18,2),
  currency             text NOT NULL DEFAULT 'UGX',
  remaining_materials  jsonb NOT NULL DEFAULT '[]'::jsonb,
  returned_assets      jsonb NOT NULL DEFAULT '[]'::jsonb,
  unresolved_issue_count integer NOT NULL DEFAULT 0,
  client_accepted_at   timestamptz,
  accepted_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  handover_doc_id      uuid REFERENCES documents(id) ON DELETE SET NULL,
  lessons_learned      text,
  pnl_result           numeric(18,2),
  status               text NOT NULL DEFAULT 'in_progress'
                         CHECK (status IN ('in_progress','accepted','closed')),
  created_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_closures_project_unique UNIQUE (project_id)
);
CREATE INDEX IF NOT EXISTS idx_project_closures_project ON project_closures(project_id);
