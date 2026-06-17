-- 0012_procurement_line_identity.sql
-- Phase B2: give procurement line items a real identity (name + specification +
-- supplier + budget category + computed total), and prepare per-category budget
-- commitments. Additive + idempotent. DB is near-empty so backfill is trivial.

-- Budget categories used across procurement + budget lines.
-- materials | labour | transport | equipment | permits | subcontractors | contingency | other

-- ── Line items ────────────────────────────────────────────────────────────
ALTER TABLE procurement_request_lines ADD COLUMN IF NOT EXISTS item_name       text;
ALTER TABLE procurement_request_lines ADD COLUMN IF NOT EXISTS specification   text;
ALTER TABLE procurement_request_lines ADD COLUMN IF NOT EXISTS supplier_name   text;
ALTER TABLE procurement_request_lines ADD COLUMN IF NOT EXISTS supplier_id     uuid;
ALTER TABLE procurement_request_lines ADD COLUMN IF NOT EXISTS budget_category text;
ALTER TABLE procurement_request_lines ADD COLUMN IF NOT EXISTS catalog_item_id uuid;  -- future resource catalog

-- Backfill item_name from the old free-text description, then enforce NOT NULL.
UPDATE procurement_request_lines SET item_name = COALESCE(item_name, NULLIF(description,''), 'Item') WHERE item_name IS NULL;
ALTER TABLE procurement_request_lines ALTER COLUMN item_name SET NOT NULL;

-- Computed line total (qty × unit cost) — both columns are NOT NULL DEFAULT 0.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='procurement_request_lines' AND column_name='est_total') THEN
    ALTER TABLE procurement_request_lines
      ADD COLUMN est_total numeric(18,2) GENERATED ALWAYS AS (quantity * est_unit_cost) STORED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='procurement_lines_supplier_fk') THEN
    ALTER TABLE procurement_request_lines
      ADD CONSTRAINT procurement_lines_supplier_fk FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='procurement_lines_budget_category_chk') THEN
    ALTER TABLE procurement_request_lines
      ADD CONSTRAINT procurement_lines_budget_category_chk
      CHECK (budget_category IS NULL OR budget_category IN
             ('materials','labour','transport','equipment','permits','subcontractors','contingency','other'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_proc_lines_category ON procurement_request_lines(budget_category);

-- ── Request header ────────────────────────────────────────────────────────
ALTER TABLE procurement_requests ADD COLUMN IF NOT EXISTS reason          text;
ALTER TABLE procurement_requests ADD COLUMN IF NOT EXISTS budget_category text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='procurement_requests_budget_category_chk') THEN
    ALTER TABLE procurement_requests
      ADD CONSTRAINT procurement_requests_budget_category_chk
      CHECK (budget_category IS NULL OR budget_category IN
             ('materials','labour','transport','equipment','permits','subcontractors','contingency','other'));
  END IF;
END $$;

-- ── Commitments gain a budget category (per-category attribution) ──────────
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS budget_category text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='commitments_budget_category_chk') THEN
    ALTER TABLE commitments
      ADD CONSTRAINT commitments_budget_category_chk
      CHECK (budget_category IS NULL OR budget_category IN
             ('materials','labour','transport','equipment','permits','subcontractors','contingency','other'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_commitments_category ON commitments(project_id, budget_category);
