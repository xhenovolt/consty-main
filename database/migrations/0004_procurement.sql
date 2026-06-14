-- 0004_procurement.sql
-- Procurement + goods-receipt/inspection.
-- Flow: Request → Approval → Order → Receive → Inspect → Store → Allocate → Close.
-- Approvals reuse the existing polymorphic `approval_requests` engine.

CREATE TABLE IF NOT EXISTS procurement_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_item_id        uuid REFERENCES work_items(id) ON DELETE SET NULL,
  title               text NOT NULL,
  description         text,
  status              text NOT NULL DEFAULT 'requested'
                        CHECK (status IN ('requested','approved','ordered','received',
                                          'inspected','stored','allocated','closed','rejected')),
  approval_request_id uuid REFERENCES approval_requests(id) ON DELETE SET NULL,
  supplier_id         uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  total_est_cost      numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_est_cost >= 0),
  currency            text NOT NULL DEFAULT 'UGX',
  needed_by           date,
  requested_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at         timestamptz,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_procurement_project  ON procurement_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_procurement_status   ON procurement_requests(status);
CREATE INDEX IF NOT EXISTS idx_procurement_supplier ON procurement_requests(supplier_id);

CREATE TABLE IF NOT EXISTS procurement_request_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES procurement_requests(id) ON DELETE CASCADE,
  resource_id   uuid REFERENCES resources(id) ON DELETE SET NULL,
  description   text NOT NULL,
  quantity      numeric(18,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit          text,
  est_unit_cost numeric(18,2) NOT NULL DEFAULT 0 CHECK (est_unit_cost >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proc_lines_request ON procurement_request_lines(request_id);

CREATE TABLE IF NOT EXISTS goods_receipts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_request_id uuid NOT NULL REFERENCES procurement_requests(id) ON DELETE CASCADE,
  supplier_id           uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  received_qty          numeric(18,3) NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
  rejected_qty          numeric(18,3) NOT NULL DEFAULT 0 CHECK (rejected_qty >= 0),
  inspection_status     text NOT NULL DEFAULT 'pending'
                          CHECK (inspection_status IN ('pending','passed','failed','conditional')),
  inspected_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  receipt_url           text,
  stored_to_location    text,
  notes                 text,
  received_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_request ON goods_receipts(procurement_request_id);
