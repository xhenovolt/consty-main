-- 0015_resource_catalog.sql
-- Phase 4: a reusable, company-wide resource/material catalog so materials are
-- defined once and reused across projects (stops duplicate per-project items).
-- Project `resources` reference a catalog item; project-specific quantities/cost
-- stay on `resources`. Additive + idempotent.

CREATE TABLE IF NOT EXISTS resource_catalog (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  category            text NOT NULL
                        CHECK (category IN ('labour','staff','subcontractor','equipment','vehicle',
                                            'material','tool','fuel','water','power','money',
                                            'document','permit','reusable_asset','consumable')),
  type                text,
  unit_of_measure     text,
  specification       text,
  manufacturer        text,
  default_supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  default_unit_cost   numeric(18,2) NOT NULL DEFAULT 0 CHECK (default_unit_cost >= 0),
  currency            text NOT NULL DEFAULT 'UGX',
  attributes          jsonb NOT NULL DEFAULT '{}'::jsonb,  -- size/grade/mass/batch rules/fuel type…
  is_active           boolean NOT NULL DEFAULT true,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resource_catalog_category ON resource_catalog(category);
CREATE INDEX IF NOT EXISTS idx_resource_catalog_name     ON resource_catalog(lower(name));

-- Link project resources to the catalog (project keeps its own quantities/cost).
ALTER TABLE resources ADD COLUMN IF NOT EXISTS catalog_item_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='resources_catalog_fk') THEN
    ALTER TABLE resources ADD CONSTRAINT resources_catalog_fk
      FOREIGN KEY (catalog_item_id) REFERENCES resource_catalog(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_resources_catalog ON resources(catalog_item_id);
