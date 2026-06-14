-- 0003_resources_inventory.sql
-- CONSTY resources, materials, equipment, vehicles, labour, consumables, assets.
-- Resources are first-class. Material intelligence lives in `attributes` jsonb
-- (grade/size/mass/batch/expiry/brand/diameter/litres...) validated per category
-- in the app layer. Quantities are derived from resource_movements (the
-- inventory ledger). Sister-resource relations are SOFT links.

-- ───────────────────────────── SUPPLIERS ────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  contact_name   text,
  phone          text,
  email          text,
  category       text,
  rating         numeric(3,2) CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
  lead_time_days integer CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
  address        text,
  notes          text,
  is_active      boolean NOT NULL DEFAULT true,
  created_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);

-- ───────────────────────────── RESOURCES ────────────────────────────
-- project_id NULL = company pool; set = allocated/owned by a project.
CREATE TABLE IF NOT EXISTS resources (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid REFERENCES projects(id) ON DELETE CASCADE,
  name               text NOT NULL,
  category           text NOT NULL
                       CHECK (category IN ('labour','staff','subcontractor','equipment','vehicle',
                                           'material','tool','fuel','water','power','money',
                                           'document','permit','reusable_asset','consumable')),
  type               text,
  unit_of_measure    text,
  size               text,
  mass_kg            numeric(14,3),
  quantity_required  numeric(18,3) NOT NULL DEFAULT 0 CHECK (quantity_required  >= 0),
  quantity_available numeric(18,3) NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  quantity_consumed  numeric(18,3) NOT NULL DEFAULT 0 CHECK (quantity_consumed  >= 0),
  quantity_returned  numeric(18,3) NOT NULL DEFAULT 0 CHECK (quantity_returned  >= 0),
  quantity_wasted    numeric(18,3) NOT NULL DEFAULT 0 CHECK (quantity_wasted    >= 0),
  unit_cost          numeric(18,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  currency           text NOT NULL DEFAULT 'UGX',
  condition          text CHECK (condition IS NULL OR condition IN ('new','refurbished','used','damaged','expired')),
  manufacturer       text,
  supplier_id        uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  source             text,
  storage_location   text,
  is_reusable        boolean NOT NULL DEFAULT false,
  attributes         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- material intelligence
  notes              text,
  created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resources_project  ON resources(project_id);
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_supplier ON resources(supplier_id);

-- ──────────────── SISTER / DEPENDENT RESOURCES (soft) ────────────────
CREATE TABLE IF NOT EXISTS resource_relations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id            uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  depends_on_resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  relation_type          text NOT NULL DEFAULT 'requires'
                           CHECK (relation_type IN ('requires','consumes','operated_by','transported_by')),
  note                   text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resource_relation_not_self CHECK (resource_id <> depends_on_resource_id),
  CONSTRAINT resource_relation_unique UNIQUE (resource_id, depends_on_resource_id, relation_type)
);
CREATE INDEX IF NOT EXISTS idx_resource_relations_res ON resource_relations(resource_id);

-- ─────────────────────── RESOURCE ALLOCATIONS ───────────────────────
CREATE TABLE IF NOT EXISTS resource_allocations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id        uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  project_id         uuid REFERENCES projects(id) ON DELETE CASCADE,
  work_item_id       uuid REFERENCES work_items(id) ON DELETE SET NULL,
  quantity_allocated numeric(18,3) NOT NULL DEFAULT 0 CHECK (quantity_allocated >= 0),
  status             text NOT NULL DEFAULT 'planned'
                       CHECK (status IN ('planned','active','released')),
  created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resource_alloc_resource ON resource_allocations(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_alloc_workitem ON resource_allocations(work_item_id);

-- ───────────────────── RESOURCE MOVEMENTS (ledger) ──────────────────
CREATE TABLE IF NOT EXISTS resource_movements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id   uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  movement_type text NOT NULL
                  CHECK (movement_type IN ('receive','inspect','store','issue','transfer',
                                           'consume','return','waste','adjust')),
  quantity      numeric(18,3) NOT NULL CHECK (quantity >= 0),
  from_location text,
  to_location   text,
  work_item_id  uuid REFERENCES work_items(id) ON DELETE SET NULL,
  supplier_id   uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  reference     text,
  notes         text,
  moved_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  moved_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resource_moves_resource ON resource_movements(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_moves_type     ON resource_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_resource_moves_workitem ON resource_movements(work_item_id);
