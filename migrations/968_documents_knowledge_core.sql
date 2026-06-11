-- Migration 968: Documents knowledge core — versions, comments, permissions, approvals, links, folders, tags, templates.
-- Phase 5 of enterprise hardening. Idempotent.

-- ============================================================
-- 1. Extend documents
-- ============================================================
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id        UUID;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS template_id      UUID;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS body_format      VARCHAR(20)
  CHECK (body_format IS NULL OR body_format IN ('markdown','rich','plain','html'));
ALTER TABLE documents ADD COLUMN IF NOT EXISTS body             TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS current_version  INTEGER DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS approval_status  VARCHAR(20) DEFAULT 'draft'
  CHECK (approval_status IN ('draft','in_review','approved','rejected','archived'));
ALTER TABLE documents ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS approved_by      UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS visibility       VARCHAR(20) DEFAULT 'internal'
  CHECK (visibility IN ('private','internal','department','public'));
ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata         JSONB DEFAULT '{}'::jsonb;

-- The CHECK on category is too narrow for a real knowledge core; widen it.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'documents'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%category%'
  LOOP
    EXECUTE 'ALTER TABLE documents DROP CONSTRAINT IF EXISTS ' || quote_ident(c.conname);
  END LOOP;
END $$;
-- Allow free-form categories now; folders carry semantic structure.

-- ============================================================
-- 2. document_folders — hierarchical organisation
-- ============================================================
CREATE TABLE IF NOT EXISTS document_folders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  parent_id       UUID REFERENCES document_folders(id) ON DELETE CASCADE,
  path            TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_folders_parent_id ON document_folders(parent_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_documents_folder') THEN
    ALTER TABLE documents
      ADD CONSTRAINT fk_documents_folder
      FOREIGN KEY (folder_id) REFERENCES document_folders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 3. document_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS document_tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL UNIQUE,
  color           VARCHAR(20),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS document_tag_links (
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id          UUID NOT NULL REFERENCES document_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, tag_id)
);

-- ============================================================
-- 4. document_versions — snapshot per save
-- ============================================================
CREATE TABLE IF NOT EXISTS document_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  title           VARCHAR(255) NOT NULL,
  body            TEXT,
  body_format     VARCHAR(20),
  file_url        TEXT,
  file_name       VARCHAR(255),
  file_size       BIGINT,
  changelog       TEXT,
  is_current      BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_document_versions UNIQUE (document_id, version)
);
CREATE INDEX IF NOT EXISTS idx_document_versions_doc ON document_versions(document_id);

-- ============================================================
-- 5. document_comments — threaded discussion
-- ============================================================
CREATE TABLE IF NOT EXISTS document_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES document_comments(id) ON DELETE CASCADE,
  author_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  body            TEXT NOT NULL,
  resolved        BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_comments_doc ON document_comments(document_id);

-- ============================================================
-- 6. document_permissions — explicit ACLs (in addition to RBAC)
-- ============================================================
CREATE TABLE IF NOT EXISTS document_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  principal_type  VARCHAR(20) NOT NULL CHECK (principal_type IN ('user','department','role')),
  principal_id    UUID NOT NULL,
  permission      VARCHAR(20) NOT NULL CHECK (permission IN ('view','comment','edit','admin')),
  granted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_document_permissions UNIQUE (document_id, principal_type, principal_id, permission)
);

-- ============================================================
-- 7. document_approvals — workflow steps
-- ============================================================
CREATE TABLE IF NOT EXISTS document_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  step_order      INTEGER NOT NULL,
  approver_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','skipped')),
  decision_at     TIMESTAMPTZ,
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_document_approvals UNIQUE (document_id, step_order)
);

-- ============================================================
-- 8. document_links — attach docs to any entity
-- ============================================================
CREATE TABLE IF NOT EXISTS document_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  entity_type     VARCHAR(50) NOT NULL,
  -- system | department | staff | client | deal | subscription | invoice | issue | proposal | license | backup
  entity_id       UUID NOT NULL,
  relationship    VARCHAR(40) DEFAULT 'attached',
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_document_links UNIQUE (document_id, entity_type, entity_id, relationship)
);
CREATE INDEX IF NOT EXISTS idx_document_links_entity ON document_links(entity_type, entity_id);

-- ============================================================
-- 9. document_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS document_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  category        VARCHAR(50),
  body            TEXT,
  body_format     VARCHAR(20) DEFAULT 'markdown',
  variables       JSONB DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_documents_template') THEN
    ALTER TABLE documents
      ADD CONSTRAINT fk_documents_template
      FOREIGN KEY (template_id) REFERENCES document_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 10. Permissions
-- ============================================================
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('documents','view',     'View documents',         '/api/documents'),
  ('documents','create',   'Create documents',       '/api/documents'),
  ('documents','edit',     'Edit documents',         '/api/documents'),
  ('documents','delete',   'Delete documents',       '/api/documents'),
  ('documents','approve',  'Approve documents',      '/api/documents'),
  ('documents','share',    'Manage document ACLs',   '/api/documents/permissions')
ON CONFLICT DO NOTHING;
