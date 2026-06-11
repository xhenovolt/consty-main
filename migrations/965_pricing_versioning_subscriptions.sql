-- Migration 965: Pricing versioning + subscription lifecycle engine
-- Phase 2 of enterprise hardening. Idempotent.

-- ============================================================
-- 1. Extend pricing_plans for richer plan structure
-- ============================================================
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS setup_fee           NUMERIC(15,2) DEFAULT 0;
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS trial_days          INTEGER DEFAULT 0;
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS grace_days          INTEGER DEFAULT 0;
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS max_users           INTEGER;
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS max_students        INTEGER;
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS sms_limit           INTEGER;
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS support_tier        VARCHAR(20)
  CHECK (support_tier IS NULL OR support_tier IN ('none','basic','standard','priority','enterprise'));
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS deployment_type     VARCHAR(20)
  CHECK (deployment_type IS NULL OR deployment_type IN ('cloud','onpremise','hybrid'));
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS implementation_complexity VARCHAR(20)
  CHECK (implementation_complexity IS NULL OR implementation_complexity IN ('low','medium','high','enterprise'));
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS onboarding_hours    INTEGER;
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS current_version     INTEGER DEFAULT 1;

-- ============================================================
-- 2. pricing_plan_versions — every persisted version snapshot
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_plan_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES pricing_plans(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  features        JSONB DEFAULT '[]',
  setup_fee       NUMERIC(15,2),
  trial_days      INTEGER,
  grace_days      INTEGER,
  max_users       INTEGER,
  max_students    INTEGER,
  sms_limit       INTEGER,
  support_tier    VARCHAR(20),
  deployment_type VARCHAR(20),
  implementation_complexity VARCHAR(20),
  onboarding_hours INTEGER,
  cycles_snapshot JSONB DEFAULT '[]'::jsonb,
  is_current      BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pricing_plan_versions UNIQUE (plan_id, version)
);
CREATE INDEX IF NOT EXISTS idx_pricing_plan_versions_plan_id ON pricing_plan_versions(plan_id);
CREATE INDEX IF NOT EXISTS idx_pricing_plan_versions_current ON pricing_plan_versions(plan_id) WHERE is_current;

-- ============================================================
-- 3. pricing_plan_changes — audit log of mutations
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_plan_changes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES pricing_plans(id) ON DELETE CASCADE,
  from_version    INTEGER,
  to_version      INTEGER,
  change_type     VARCHAR(40) NOT NULL,
  field_changes   JSONB DEFAULT '{}',
  reason          TEXT,
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pricing_plan_changes_plan_id ON pricing_plan_changes(plan_id);

-- ============================================================
-- 4. pricing_plan_features — first-class feature rows
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_plan_features (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES pricing_plans(id) ON DELETE CASCADE,
  feature_key     VARCHAR(100) NOT NULL,
  feature_label   TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  limit_value     INTEGER,
  notes           TEXT,
  display_order   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pricing_plan_features ON pricing_plan_features(plan_id, feature_key);

-- ============================================================
-- 5. pricing_plan_feature_history — feature mutation log
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_plan_feature_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES pricing_plans(id) ON DELETE CASCADE,
  feature_key     VARCHAR(100) NOT NULL,
  before_state    JSONB,
  after_state     JSONB,
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pricing_plan_feature_history_plan_id ON pricing_plan_feature_history(plan_id);

-- ============================================================
-- 6. Subscriptions — extend lifecycle columns
-- ============================================================
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_version_id UUID REFERENCES pricing_plan_versions(id) ON DELETE SET NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paused_at        TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pause_reason     TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS resumed_at       TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS overdue_at       TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS grace_until      DATE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at     TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_by     UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS retention_attempted BOOLEAN DEFAULT FALSE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS retention_outcome   TEXT;

-- Drop and re-create the status check
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'subscriptions'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE 'ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS ' || quote_ident(c.conname);
  END LOOP;
END $$;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (
  status IN ('pending','trial','active','paused','overdue','expired','cancelled')
);

-- ============================================================
-- 7. subscription_cycles — billing periods
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_cycles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  cycle_number    INTEGER NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','overdue','waived','refunded','cancelled')),
  amount          NUMERIC(15,2) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'UGX',
  invoice_id      UUID,
  payment_id      UUID,
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscription_cycles_subscription_id ON subscription_cycles(subscription_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_cycles_number ON subscription_cycles(subscription_id, cycle_number);

-- ============================================================
-- 8. subscription_events — lifecycle event stream
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  event_type      VARCHAR(40) NOT NULL,
  -- created | activated | renewed | paused | resumed | cancelled | expired
  -- upgraded | downgraded | trial_converted | grace_extended | retention_attempted
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  description     TEXT,
  before_state    JSONB,
  after_state     JSONB,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscription_events_sub ON subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);

-- ============================================================
-- 9. subscription_payments — payment events tied to subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  cycle_id        UUID REFERENCES subscription_cycles(id) ON DELETE SET NULL,
  amount          NUMERIC(15,2) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'UGX',
  method          VARCHAR(40),
  reference       VARCHAR(255),
  status          VARCHAR(20) NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending','completed','failed','refunded')),
  recorded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_sub ON subscription_payments(subscription_id);

-- ============================================================
-- 10. subscription_status_history
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_status_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  from_status     VARCHAR(20),
  to_status       VARCHAR(20) NOT NULL,
  reason          TEXT,
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscription_status_history_sub ON subscription_status_history(subscription_id);

-- ============================================================
-- 11. subscription_pause_history
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_pause_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  paused_at       TIMESTAMPTZ NOT NULL,
  resumed_at      TIMESTAMPTZ,
  reason          TEXT,
  paused_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  resumed_by      UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_subscription_pause_history_sub ON subscription_pause_history(subscription_id);

-- ============================================================
-- 12. Permissions: subscription lifecycle actions
-- ============================================================
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('subscriptions','pause',   'Pause subscriptions',  '/api/subscriptions'),
  ('subscriptions','resume',  'Resume subscriptions', '/api/subscriptions'),
  ('subscriptions','upgrade', 'Upgrade subscriptions','/api/subscriptions'),
  ('subscriptions','downgrade','Downgrade subscriptions','/api/subscriptions')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 13. Seed initial v1 snapshot for existing pricing_plans
-- ============================================================
INSERT INTO pricing_plan_versions (plan_id, version, name, description, features, is_current)
SELECT pp.id, 1, pp.name, pp.description, pp.features, TRUE
FROM pricing_plans pp
WHERE NOT EXISTS (SELECT 1 FROM pricing_plan_versions v WHERE v.plan_id = pp.id);
