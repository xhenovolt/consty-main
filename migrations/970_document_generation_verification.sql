-- Migration 970: Document generation and verification — professional official documents
-- Phase 6 of enterprise hardening. Idempotent.

-- ============================================================
-- 1. company_branding — organizational identity
-- ============================================================
CREATE TABLE IF NOT EXISTS company_branding (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name VARCHAR(255) NOT NULL,
  organization_slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url        TEXT,
  logo_width      INTEGER DEFAULT 100,
  logo_height     INTEGER DEFAULT 100,
  header_text     TEXT,
  footer_text     TEXT,
  signature_url   TEXT,
  signature_name  VARCHAR(255),
  signature_title VARCHAR(255),
  address_line1   VARCHAR(255),
  address_line2   VARCHAR(255),
  city            VARCHAR(100),
  postal_code     VARCHAR(20),
  country         VARCHAR(100),
  phone           VARCHAR(20),
  email           VARCHAR(255),
  website         VARCHAR(255),
  primary_color   VARCHAR(7) DEFAULT '#1F2937',
  secondary_color VARCHAR(7) DEFAULT '#3B82F6',
  accent_color    VARCHAR(7) DEFAULT '#10B981',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_branding_active ON company_branding(is_active) WHERE is_active;

-- ============================================================
-- 2. generated_documents — official documents with verification
-- ============================================================
CREATE TABLE IF NOT EXISTS generated_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID REFERENCES documents(id) ON DELETE CASCADE,
  template_id     UUID NOT NULL REFERENCES document_templates(id) ON DELETE RESTRICT,
  branding_id     UUID REFERENCES company_branding(id) ON DELETE SET NULL,
  unique_id       VARCHAR(50) NOT NULL UNIQUE,
  -- Format: XTN-PREFIX-YEAR-SEQUENCE (e.g., XTN-INT-2026-0001)
  title           VARCHAR(255) NOT NULL,
  document_type   VARCHAR(50) NOT NULL,
  -- internship_acceptance | interview_invitation | job_application_response | certificate | award | other
  recipient_name  VARCHAR(255) NOT NULL,
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  metadata        JSONB DEFAULT '{}',
  -- Stores all placeholder substitutions for audit trail
  placeholder_data JSONB NOT NULL DEFAULT '{}',
  pdf_url         TEXT,
  pdf_size        BIGINT,
  qr_code_url     TEXT,
  verification_token VARCHAR(255) NOT NULL UNIQUE,
  -- Hash token for public URL: hash(unique_id + secret)
  verification_hash VARCHAR(64) NOT NULL UNIQUE,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  viewed_count    INTEGER DEFAULT 0,
  last_viewed_at  TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  is_revoked      BOOLEAN DEFAULT FALSE,
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  revocation_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generated_documents_unique_id ON generated_documents(unique_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_verification_token ON generated_documents(verification_token);
CREATE INDEX IF NOT EXISTS idx_generated_documents_verification_hash ON generated_documents(verification_hash);
CREATE INDEX IF NOT EXISTS idx_generated_documents_template ON generated_documents(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_recipient_email ON generated_documents(recipient_email);
CREATE INDEX IF NOT EXISTS idx_generated_documents_generated_by ON generated_documents(generated_by);
CREATE INDEX IF NOT EXISTS idx_generated_documents_created_at ON generated_documents(created_at DESC);

-- ============================================================
-- 3. document_verifications — public verification audit
-- ============================================================
CREATE TABLE IF NOT EXISTS document_verifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,
  verified_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verification_token VARCHAR(255),
  viewer_ip       VARCHAR(45),
  viewer_user_agent TEXT,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'valid'
    CHECK (verification_status IN ('valid','revoked','expired','not_found')),
  viewer_name     VARCHAR(255),
  viewer_email    VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_verifications_generated_doc ON document_verifications(generated_document_id);
CREATE INDEX IF NOT EXISTS idx_document_verifications_verified_at ON document_verifications(verified_at DESC);

-- ============================================================
-- 4. generated_document_logs — audit trail for generation
-- ============================================================
CREATE TABLE IF NOT EXISTS generated_document_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,
  level           VARCHAR(10) NOT NULL DEFAULT 'info'
    CHECK (level IN ('debug','info','warn','error')),
  phase           VARCHAR(40),
  message         TEXT NOT NULL,
  details         JSONB DEFAULT '{}',
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generated_document_logs_doc ON generated_document_logs(generated_document_id);
CREATE INDEX IF NOT EXISTS idx_generated_document_logs_level ON generated_document_logs(level);

-- ============================================================
-- 5. Permissions for document generation and verification
-- ============================================================
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('documents','generate',    'Generate official documents',    '/api/documents/generate'),
  ('documents','verify',      'Verify documents',               '/api/documents/verify'),
  ('documents','branding',    'Manage company branding',        '/api/documents/branding'),
  ('documents','revoke',      'Revoke generated documents',     '/api/documents/generated'),
  ('documents','view_generated','View generated documents',      '/api/documents/generated')
ON CONFLICT DO NOTHING;
