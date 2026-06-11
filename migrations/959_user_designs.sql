-- Migration 959: User Designs — Consty Design Editor
-- Stores the full JSON layer model for each user design

CREATE TABLE IF NOT EXISTS user_designs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL DEFAULT 'Untitled Design',
  thumbnail    TEXT,                        -- data URL or Cloudinary URL
  canvas       JSONB       NOT NULL DEFAULT '{"width":1080,"height":1080}',
  layers       JSONB       NOT NULL DEFAULT '[]',
  tags         TEXT[]      DEFAULT '{}',
  is_template  BOOLEAN     DEFAULT FALSE,   -- can be promoted to template
  created_by   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_designs_created_by ON user_designs(created_by);
CREATE INDEX IF NOT EXISTS idx_user_designs_is_template ON user_designs(is_template);
CREATE INDEX IF NOT EXISTS idx_user_designs_updated_at ON user_designs(updated_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_designs_updated_at') THEN
    CREATE TRIGGER trg_user_designs_updated_at
      BEFORE UPDATE ON user_designs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Seed: starter templates visible to everyone
INSERT INTO user_designs (name, is_template, canvas, layers, created_by)
SELECT
  'Blank 1080×1080',
  TRUE,
  '{"width":1080,"height":1080,"background":"#ffffff"}',
  '[]',
  u.id
FROM users u WHERE u.role = 'superadmin' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO user_designs (name, is_template, canvas, layers, created_by)
SELECT
  'Blank A4 (Portrait)',
  TRUE,
  '{"width":794,"height":1123,"background":"#ffffff"}',
  '[]',
  u.id
FROM users u WHERE u.role = 'superadmin' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO user_designs (name, is_template, canvas, layers, created_by)
SELECT
  'Blank Banner (1920×600)',
  TRUE,
  '{"width":1920,"height":600,"background":"#1e293b"}',
  '[]',
  u.id
FROM users u WHERE u.role = 'superadmin' LIMIT 1
ON CONFLICT DO NOTHING;
