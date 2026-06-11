-- =============================================================================
-- MIGRATION 960: PROPOSAL ENGINE — DRAIS SALES AUTOMATION
-- =============================================================================
-- Tables: drais_systems, pricing_plans, pricing_features, proposals, proposal_snapshots
-- Seeded with DRAIS Professional / Premium / Gold data (UGX)
-- =============================================================================

-- ============================================================
-- 1. DRAIS SYSTEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS drais_systems (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  positioning TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_drais_systems_name ON drais_systems(name);

-- ============================================================
-- 2. PRICING PLANS (per system)
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id           UUID NOT NULL REFERENCES drais_systems(id) ON DELETE CASCADE,
  name                VARCHAR(100) NOT NULL,
  installation_fee    NUMERIC(15,2) NOT NULL DEFAULT 0,
  annual_subscription NUMERIC(15,2) NOT NULL DEFAULT 0,
  student_limit       INTEGER,   -- NULL = unlimited
  is_popular          BOOLEAN DEFAULT FALSE,
  is_active           BOOLEAN DEFAULT TRUE,
  display_order       INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_plans_system_id ON pricing_plans(system_id);

-- ============================================================
-- 3. PRICING FEATURES (per plan)
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_features (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id             UUID NOT NULL REFERENCES pricing_plans(id) ON DELETE CASCADE,
  feature_name        VARCHAR(300) NOT NULL,
  feature_description TEXT,
  category            VARCHAR(100) DEFAULT 'general',
  display_order       INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_features_plan_id ON pricing_features(plan_id);

-- ============================================================
-- 4. PROPOSALS
-- ============================================================
CREATE TABLE IF NOT EXISTS proposals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id      UUID NOT NULL REFERENCES prospects(id) ON DELETE RESTRICT,
  system_id        UUID NOT NULL REFERENCES drais_systems(id) ON DELETE RESTRICT,
  selected_plan_id UUID NOT NULL REFERENCES pricing_plans(id) ON DELETE RESTRICT,
  custom_notes     TEXT,
  discount_percent NUMERIC(5,2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  payment_terms    VARCHAR(300),
  status           VARCHAR(30) DEFAULT 'draft'
    CHECK (status IN ('draft','generated','sent','accepted','rejected')),
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_prospect_id   ON proposals(prospect_id);
CREATE INDEX IF NOT EXISTS idx_proposals_system_id     ON proposals(system_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status        ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created_by    ON proposals(created_by);

-- ============================================================
-- 5. PROPOSAL SNAPSHOTS (immutable)
-- ============================================================
CREATE TABLE IF NOT EXISTS proposal_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  full_payload  JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_snapshots_proposal_id ON proposal_snapshots(proposal_id);

-- ============================================================
-- 6. TRIGGERS — updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_drais_systems_updated_at') THEN
    CREATE TRIGGER trg_drais_systems_updated_at
      BEFORE UPDATE ON drais_systems FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pricing_plans_updated_at') THEN
    CREATE TRIGGER trg_pricing_plans_updated_at
      BEFORE UPDATE ON pricing_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_proposals_updated_at') THEN
    CREATE TRIGGER trg_proposals_updated_at
      BEFORE UPDATE ON proposals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ============================================================
-- 7. SEED — DRAIS SYSTEM
-- ============================================================
INSERT INTO drais_systems (id, name, description, positioning)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'DRAIS',
  'Digital Records and Attendance Intelligence System — a complete school management platform built for African institutions.',
  'Attendance-first school management system designed to give schools real-time visibility, control, and automation starting from student presence.'
)
ON CONFLICT (name) DO UPDATE SET
  description  = EXCLUDED.description,
  positioning  = EXCLUDED.positioning,
  updated_at   = NOW();

-- ============================================================
-- 8. SEED — PRICING PLANS
-- ============================================================

-- Professional
INSERT INTO pricing_plans (id, system_id, name, installation_fee, annual_subscription, student_limit, is_popular, display_order)
VALUES (
  'b1000000-0000-0000-0000-000000000001',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Professional', 1000000, 200000, 1000, FALSE, 1
)
ON CONFLICT (id) DO UPDATE SET
  installation_fee    = EXCLUDED.installation_fee,
  annual_subscription = EXCLUDED.annual_subscription,
  student_limit       = EXCLUDED.student_limit,
  updated_at          = NOW();

-- Premium
INSERT INTO pricing_plans (id, system_id, name, installation_fee, annual_subscription, student_limit, is_popular, display_order)
VALUES (
  'b1000000-0000-0000-0000-000000000002',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Premium', 1800000, 350000, 2000, TRUE, 2
)
ON CONFLICT (id) DO UPDATE SET
  installation_fee    = EXCLUDED.installation_fee,
  annual_subscription = EXCLUDED.annual_subscription,
  student_limit       = EXCLUDED.student_limit,
  is_popular          = EXCLUDED.is_popular,
  updated_at          = NOW();

-- Gold
INSERT INTO pricing_plans (id, system_id, name, installation_fee, annual_subscription, student_limit, is_popular, display_order)
VALUES (
  'b1000000-0000-0000-0000-000000000003',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Gold', 2500000, 500000, NULL, FALSE, 3
)
ON CONFLICT (id) DO UPDATE SET
  installation_fee    = EXCLUDED.installation_fee,
  annual_subscription = EXCLUDED.annual_subscription,
  student_limit       = EXCLUDED.student_limit,
  updated_at          = NOW();

-- ============================================================
-- 9. SEED — FEATURES: Professional
-- ============================================================
DELETE FROM pricing_features WHERE plan_id = 'b1000000-0000-0000-0000-000000000001';
INSERT INTO pricing_features (plan_id, feature_name, category, display_order) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Fingerprint attendance system',       'attendance',    1),
  ('b1000000-0000-0000-0000-000000000001', 'Real-time parent SMS alerts',          'communication', 2),
  ('b1000000-0000-0000-0000-000000000001', 'Student information system',           'records',       3),
  ('b1000000-0000-0000-0000-000000000001', 'Daily attendance reports',             'analytics',     4),
  ('b1000000-0000-0000-0000-000000000001', 'Basic reporting & dashboards',         'analytics',     5),
  ('b1000000-0000-0000-0000-000000000001', 'Email & phone support',                'support',       6);

-- ============================================================
-- 10. SEED — FEATURES: Premium
-- ============================================================
DELETE FROM pricing_features WHERE plan_id = 'b1000000-0000-0000-0000-000000000002';
INSERT INTO pricing_features (plan_id, feature_name, category, display_order) VALUES
  ('b1000000-0000-0000-0000-000000000002', 'Everything in Professional',           'base',          1),
  ('b1000000-0000-0000-0000-000000000002', 'Full exam & report card system',       'academics',     2),
  ('b1000000-0000-0000-0000-000000000002', 'Advanced analytics & dashboards',      'analytics',     3),
  ('b1000000-0000-0000-0000-000000000002', 'Mobile app access',                    'access',        4),
  ('b1000000-0000-0000-0000-000000000002', 'Parent communication portal',          'communication', 5),
  ('b1000000-0000-0000-0000-000000000002', 'SMS broadcast messaging',              'communication', 6),
  ('b1000000-0000-0000-0000-000000000002', 'Priority support',                     'support',       7);

-- ============================================================
-- 11. SEED — FEATURES: Gold
-- ============================================================
DELETE FROM pricing_features WHERE plan_id = 'b1000000-0000-0000-0000-000000000003';
INSERT INTO pricing_features (plan_id, feature_name, category, display_order) VALUES
  ('b1000000-0000-0000-0000-000000000003', 'Everything in Premium',                'base',          1),
  ('b1000000-0000-0000-0000-000000000003', 'Unlimited students',                   'records',       2),
  ('b1000000-0000-0000-0000-000000000003', 'Multi-campus support',                 'records',       3),
  ('b1000000-0000-0000-0000-000000000003', 'Custom integrations',                  'integration',   4),
  ('b1000000-0000-0000-0000-000000000003', 'Dedicated account manager',            'support',       5),
  ('b1000000-0000-0000-0000-000000000003', 'On-site setup assistance',             'support',       6),
  ('b1000000-0000-0000-0000-000000000003', 'Custom reporting',                     'analytics',     7),
  ('b1000000-0000-0000-0000-000000000003', '24/7 dedicated support',               'support',       8);
