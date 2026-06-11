-- Migration 967: Design system expansion — templates, versions, brand kits, asset library, exports.
-- Phase 4 of enterprise hardening. Idempotent. Builds on user_designs (959).

-- ============================================================
-- 1. design_templates — first-class templates (separate from user_designs)
-- ============================================================
CREATE TABLE IF NOT EXISTS design_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  category        VARCHAR(50),
  -- logo | illustration | social | business_card | flyer | sticker | banner | mockup | document | misc
  thumbnail_url   TEXT,
  preview_url     TEXT,
  canvas          JSONB NOT NULL DEFAULT '{"width":1080,"height":1080}',
  layers          JSONB NOT NULL DEFAULT '[]',
  tags            TEXT[] DEFAULT '{}',
  is_published    BOOLEAN NOT NULL DEFAULT FALSE,
  is_premium      BOOLEAN NOT NULL DEFAULT FALSE,
  current_version INTEGER NOT NULL DEFAULT 1,
  use_count       INTEGER NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_design_templates_category  ON design_templates(category);
CREATE INDEX IF NOT EXISTS idx_design_templates_published ON design_templates(is_published);

-- ============================================================
-- 2. design_template_versions — snapshot history
-- ============================================================
CREATE TABLE IF NOT EXISTS design_template_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES design_templates(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  canvas          JSONB NOT NULL,
  layers          JSONB NOT NULL,
  thumbnail_url   TEXT,
  changelog       TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_design_template_versions UNIQUE (template_id, version)
);

-- ============================================================
-- 3. design_assets — reusable media (logos, illustrations, photos, icons)
-- ============================================================
CREATE TABLE IF NOT EXISTS design_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  asset_type      VARCHAR(40) NOT NULL
    CHECK (asset_type IN ('logo','illustration','photo','icon','shape','svg','font','pattern','mockup','other')),
  category        VARCHAR(50),
  file_url        TEXT NOT NULL,
  thumbnail_url   TEXT,
  width           INTEGER,
  height          INTEGER,
  mime_type       VARCHAR(60),
  file_size       BIGINT,
  tags            TEXT[] DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_design_assets_type     ON design_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_design_assets_category ON design_assets(category);
CREATE INDEX IF NOT EXISTS idx_design_assets_tags     ON design_assets USING GIN (tags);

-- ============================================================
-- 4. design_asset_collections — saved sets of assets
-- ============================================================
CREATE TABLE IF NOT EXISTS design_asset_collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  cover_url       TEXT,
  is_shared       BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS design_asset_collection_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   UUID NOT NULL REFERENCES design_asset_collections(id) ON DELETE CASCADE,
  asset_id        UUID NOT NULL REFERENCES design_assets(id) ON DELETE CASCADE,
  display_order   INTEGER DEFAULT 0,
  CONSTRAINT uq_design_collection_items UNIQUE (collection_id, asset_id)
);

-- ============================================================
-- 5. design_projects — explicit projects layer above user_designs
-- ============================================================
CREATE TABLE IF NOT EXISTS design_projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  brandkit_id     UUID,
  cover_design_id UUID REFERENCES user_designs(id) ON DELETE SET NULL,
  is_archived     BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS design_project_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES design_projects(id) ON DELETE CASCADE,
  design_id       UUID NOT NULL REFERENCES user_designs(id) ON DELETE CASCADE,
  display_order   INTEGER DEFAULT 0,
  CONSTRAINT uq_design_project_items UNIQUE (project_id, design_id)
);

-- ============================================================
-- 6. design_brandkits — branded asset bundles
-- ============================================================
CREATE TABLE IF NOT EXISTS design_brandkits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  logos           JSONB DEFAULT '[]',          -- [{ asset_id, label, variant }]
  palette         JSONB DEFAULT '[]',          -- [{ name, hex }]
  typography      JSONB DEFAULT '[]',          -- [{ role, family, weight, size }]
  voice           JSONB DEFAULT '{}',
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_design_projects_brandkit') THEN
    ALTER TABLE design_projects
      ADD CONSTRAINT fk_design_projects_brandkit
      FOREIGN KEY (brandkit_id) REFERENCES design_brandkits(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 7. design_layers — first-class layer rows (denormalised view of user_designs.layers)
-- Used by editors that want fast layer-level queries (lock, hide, reorder).
-- ============================================================
CREATE TABLE IF NOT EXISTS design_layers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id       UUID NOT NULL REFERENCES user_designs(id) ON DELETE CASCADE,
  layer_key       VARCHAR(120) NOT NULL,
  layer_type      VARCHAR(40) NOT NULL,
  -- text | image | shape | svg | group | qr | mask | gradient
  display_order   INTEGER NOT NULL DEFAULT 0,
  locked          BOOLEAN NOT NULL DEFAULT FALSE,
  hidden          BOOLEAN NOT NULL DEFAULT FALSE,
  opacity         NUMERIC(5,3) NOT NULL DEFAULT 1.0,
  blend_mode      VARCHAR(40),
  rotation        NUMERIC(7,3) DEFAULT 0,
  position        JSONB DEFAULT '{}',
  size            JSONB DEFAULT '{}',
  data            JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_design_layers UNIQUE (design_id, layer_key)
);
CREATE INDEX IF NOT EXISTS idx_design_layers_design_id ON design_layers(design_id);

-- ============================================================
-- 8. design_exports — every render
-- ============================================================
CREATE TABLE IF NOT EXISTS design_exports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id       UUID NOT NULL REFERENCES user_designs(id) ON DELETE CASCADE,
  format          VARCHAR(10) NOT NULL CHECK (format IN ('png','jpg','svg','pdf')),
  width           INTEGER,
  height          INTEGER,
  dpi             INTEGER DEFAULT 96,
  file_url        TEXT,
  file_size       BIGINT,
  exported_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  exported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_design_exports_design_id ON design_exports(design_id);

-- ============================================================
-- 9. Permissions
-- ============================================================
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('designs','view',     'View designs',           '/api/designs'),
  ('designs','create',   'Create designs',         '/api/designs'),
  ('designs','update',   'Update designs',         '/api/designs'),
  ('designs','delete',   'Delete designs',         '/api/designs'),
  ('designs','publish',  'Publish templates',      '/api/designs/templates'),
  ('designs','manage_assets', 'Manage design assets', '/api/designs/assets')
ON CONFLICT DO NOTHING;
