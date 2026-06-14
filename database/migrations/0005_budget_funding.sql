-- 0005_budget_funding.sql
-- Project-scoped budgets, funding sources, budget lines, commitments.
-- The org ledger (accounts/ledger/expenses) remains the cash system of record;
-- this layer makes money project-aware. `expenses` gains project linkage.

-- ───────────────────────── PROJECT BUDGETS ──────────────────────────
-- committed/actual/forecast are maintained by the app/finance engine; status
-- is derived (see fn_budget_status). margin band default 10%.
CREATE TABLE IF NOT EXISTS project_budgets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  allocated_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0),
  committed_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (committed_amount >= 0),
  actual_amount    numeric(18,2) NOT NULL DEFAULT 0 CHECK (actual_amount    >= 0),
  forecast_amount  numeric(18,2) NOT NULL DEFAULT 0 CHECK (forecast_amount  >= 0),
  currency         text NOT NULL DEFAULT 'UGX',
  margin_band      numeric(5,2) NOT NULL DEFAULT 10 CHECK (margin_band >= 0),
  status           text NOT NULL DEFAULT 'balanced'
                     CHECK (status IN ('surplus','balanced','tight','deficit','frozen','overrun')),
  is_frozen        boolean NOT NULL DEFAULT false,
  freeze_reason    text,
  frozen_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_budgets_project_unique UNIQUE (project_id)
);
CREATE INDEX IF NOT EXISTS idx_project_budgets_project ON project_budgets(project_id);

-- ───────────────────────── FUNDING SOURCES ──────────────────────────
CREATE TABLE IF NOT EXISTS funding_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_type text NOT NULL
                CHECK (source_type IN ('company_wallet','client_deposit','external_funder','loan',
                                       'grant','donor','retained_earnings','manual_external')),
  name        text,
  amount      numeric(18,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency    text NOT NULL DEFAULT 'UGX',
  account_id  uuid REFERENCES accounts(id) ON DELETE SET NULL,
  reference   text,
  status      text NOT NULL DEFAULT 'pledged'
                CHECK (status IN ('pledged','received','spent')),
  restricted_to_categories text[],   -- e.g. a grant restricted to certain spend categories
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_funding_sources_project ON funding_sources(project_id);

-- ─────────────────────────── BUDGET LINES ───────────────────────────
CREATE TABLE IF NOT EXISTS budget_lines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_item_id uuid REFERENCES work_items(id) ON DELETE SET NULL,
  category     text NOT NULL,
  allocated    numeric(18,2) NOT NULL DEFAULT 0 CHECK (allocated >= 0),
  committed    numeric(18,2) NOT NULL DEFAULT 0 CHECK (committed >= 0),
  actual       numeric(18,2) NOT NULL DEFAULT 0 CHECK (actual    >= 0),
  forecast     numeric(18,2) NOT NULL DEFAULT 0 CHECK (forecast  >= 0),
  currency     text NOT NULL DEFAULT 'UGX',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budget_lines_project  ON budget_lines(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_workitem ON budget_lines(work_item_id);

-- ──────────────────────────── COMMITMENTS ───────────────────────────
-- Approved spend not yet paid (e.g. an approved procurement request).
CREATE TABLE IF NOT EXISTS commitments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_item_id           uuid REFERENCES work_items(id) ON DELETE SET NULL,
  procurement_request_id uuid REFERENCES procurement_requests(id) ON DELETE SET NULL,
  amount                 numeric(18,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency               text NOT NULL DEFAULT 'UGX',
  status                 text NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled','cancelled')),
  created_by             uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commitments_project ON commitments(project_id);

-- ───────────── PROJECT-LINK EXISTING ORG EXPENSES (additive) ─────────
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS project_id    uuid;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS work_item_id  uuid;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS commitment_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_project_fk') THEN
    ALTER TABLE expenses ADD CONSTRAINT expenses_project_fk
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_work_item_fk') THEN
    ALTER TABLE expenses ADD CONSTRAINT expenses_work_item_fk
      FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_commitment_fk') THEN
    ALTER TABLE expenses ADD CONSTRAINT expenses_commitment_fk
      FOREIGN KEY (commitment_id) REFERENCES commitments(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);

-- ───────────────────── BUDGET STATUS DERIVATION ─────────────────────
-- frozen overrides; then overrun > deficit > tight > surplus > balanced.
CREATE OR REPLACE FUNCTION fn_budget_status(p_project uuid) RETURNS text AS $$
DECLARE b project_budgets%ROWTYPE; v_status text; v_variance numeric; v_margin numeric;
BEGIN
  SELECT * INTO b FROM project_budgets WHERE project_id = p_project;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_variance := b.allocated_amount - b.forecast_amount;
  v_margin   := (b.margin_band / 100.0) * b.allocated_amount;

  IF b.is_frozen THEN                          v_status := 'frozen';
  ELSIF b.actual_amount > b.allocated_amount THEN v_status := 'overrun';
  ELSIF b.forecast_amount > b.allocated_amount THEN v_status := 'deficit';
  ELSIF v_variance < v_margin THEN             v_status := 'tight';
  ELSIF v_variance > v_margin THEN             v_status := 'surplus';
  ELSE                                         v_status := 'balanced';
  END IF;

  UPDATE project_budgets SET status = v_status, updated_at = now() WHERE project_id = p_project;
  UPDATE projects SET budget_status = v_status, updated_at = now() WHERE id = p_project;
  RETURN v_status;
END;
$$ LANGUAGE plpgsql;
