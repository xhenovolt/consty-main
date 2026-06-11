-- ================================================================
-- MIGRATION 961: COMPANY SETTINGS
-- Global key-value store for company branding & contact info.
-- Used in invoices, proposals, and all document PDFs.
-- ================================================================

CREATE TABLE IF NOT EXISTS company_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed defaults (DO NOTHING — never overwrite user-set values)
INSERT INTO company_settings (key, value) VALUES
  ('company_name',         'Consty'),
  ('company_tagline',      'Construction delivery, procurement, and project control in one workspace'),
  ('company_address',      ''),
  ('company_phone_1',      ''),
  ('company_phone_2',      ''),
  ('company_phone_3',      ''),
  ('company_email',        ''),
  ('company_website',      ''),
  ('company_logo',         ''),
  ('company_tin',          ''),
  ('company_registration', '')
ON CONFLICT (key) DO NOTHING;
