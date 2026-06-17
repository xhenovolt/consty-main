-- 0016_procurement_receiving.sql
-- Phase 1 of the receiving refactor: model real logistics — partial/batch
-- receiving, rejections, and procurement→resource synchronisation.
-- Additive + idempotent. DB near-empty ⇒ trivial backfill.

-- ── Procurement line items: per-line quantities, cost, status ──────────────
ALTER TABLE procurement_request_lines ADD COLUMN IF NOT EXISTS ordered_quantity  numeric(18,3) NOT NULL DEFAULT 0;
ALTER TABLE procurement_request_lines ADD COLUMN IF NOT EXISTS received_quantity numeric(18,3) NOT NULL DEFAULT 0;
ALTER TABLE procurement_request_lines ADD COLUMN IF NOT EXISTS rejected_quantity numeric(18,3) NOT NULL DEFAULT 0;
ALTER TABLE procurement_request_lines ADD COLUMN IF NOT EXISTS actual_unit_cost  numeric(18,2);
ALTER TABLE procurement_request_lines ADD COLUMN IF NOT EXISTS work_item_id      uuid;
ALTER TABLE procurement_request_lines ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'requested';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='procurement_request_lines' AND column_name='remaining_quantity') THEN
    ALTER TABLE procurement_request_lines
      ADD COLUMN remaining_quantity numeric(18,3) GENERATED ALWAYS AS (quantity - received_quantity - rejected_quantity) STORED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='procurement_request_lines' AND column_name='actual_total') THEN
    ALTER TABLE procurement_request_lines
      ADD COLUMN actual_total numeric(18,2) GENERATED ALWAYS AS (received_quantity * COALESCE(actual_unit_cost, est_unit_cost)) STORED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proc_lines_status_chk') THEN
    ALTER TABLE procurement_request_lines ADD CONSTRAINT proc_lines_status_chk
      CHECK (status IN ('requested','ordered','partially_received','fully_received','rejected','cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proc_lines_no_overreceipt_chk') THEN
    ALTER TABLE procurement_request_lines ADD CONSTRAINT proc_lines_no_overreceipt_chk
      CHECK (received_quantity + rejected_quantity <= quantity);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proc_lines_workitem_fk') THEN
    ALTER TABLE procurement_request_lines ADD CONSTRAINT proc_lines_workitem_fk
      FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Goods receipts: header gains project/receiver/delivery metadata ────────
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS project_id           uuid;
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS received_by          uuid;
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS delivery_note_number text;
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS receipt_document_id  uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='goods_receipts_project_fk') THEN
    ALTER TABLE goods_receipts ADD CONSTRAINT goods_receipts_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='goods_receipts_receiver_fk') THEN
    ALTER TABLE goods_receipts ADD CONSTRAINT goods_receipts_receiver_fk FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='goods_receipts_document_fk') THEN
    ALTER TABLE goods_receipts ADD CONSTRAINT goods_receipts_document_fk FOREIGN KEY (receipt_document_id) REFERENCES documents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Goods receipt LINES (the missing piece) ────────────────────────────────
CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id        uuid NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  procurement_line_item_id uuid NOT NULL REFERENCES procurement_request_lines(id) ON DELETE CASCADE,
  quantity_received       numeric(18,3) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  quantity_rejected       numeric(18,3) NOT NULL DEFAULT 0 CHECK (quantity_rejected >= 0),
  actual_unit_cost        numeric(18,2),
  storage_location        text,
  inspection_status       text NOT NULL DEFAULT 'accepted'
                            CHECK (inspection_status IN ('pending','accepted','partially_accepted','rejected')),
  rejection_reason        text,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grl_receipt ON goods_receipt_lines(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_grl_line    ON goods_receipt_lines(procurement_line_item_id);

-- ── Resources: incoming/rejected, lifecycle status, procurement source ─────
ALTER TABLE resources ADD COLUMN IF NOT EXISTS source_type        text NOT NULL DEFAULT 'manual';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS source_line_item_id uuid;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS incoming_quantity  numeric(18,3) NOT NULL DEFAULT 0;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS rejected_quantity  numeric(18,3) NOT NULL DEFAULT 0;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS status             text NOT NULL DEFAULT 'available';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='resources_source_type_chk') THEN
    ALTER TABLE resources ADD CONSTRAINT resources_source_type_chk CHECK (source_type IN ('manual','procurement'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='resources_status_chk') THEN
    ALTER TABLE resources ADD CONSTRAINT resources_status_chk
      CHECK (status IN ('expected','incoming','partially_available','available','consumed','returned','wasted','cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='resources_source_line_fk') THEN
    ALTER TABLE resources ADD CONSTRAINT resources_source_line_fk
      FOREIGN KEY (source_line_item_id) REFERENCES procurement_request_lines(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_resources_source_line ON resources(source_line_item_id);
CREATE INDEX IF NOT EXISTS idx_resources_status      ON resources(project_id, status);

-- ── Procurement request status: add partially/fully_received ───────────────
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
   WHERE conrelid='procurement_requests'::regclass AND contype='c'
     AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF cname IS NOT NULL THEN EXECUTE format('ALTER TABLE procurement_requests DROP CONSTRAINT %I', cname); END IF;
  ALTER TABLE procurement_requests ADD CONSTRAINT procurement_requests_status_chk
    CHECK (status IN ('draft','requested','submitted','approved','ordered','partially_received',
                      'fully_received','received','inspected','stored','allocated','closed','rejected','cancelled'));
END $$;
