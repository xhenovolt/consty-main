-- =============================================================================
-- MIGRATION 942: Centralized Pricing & Subscription Engine
-- Applies: 2026-03-22
-- Author:  Consty Pricing & Subscription Architect
-- Purpose:
--   Establish Consty as the SINGLE source of truth for all pricing across the
--   entire ecosystem (Consty, Drais, Lypha, and future modules).
--
--   Tables created:
--     1. pricing_plans       — plans per system (Basic, Pro, Enterprise…)
--     2. pricing_cycles      — payment intervals + price per plan
--     3. subscriptions       — per-client subscription lifecycle
--     4. subscription_billing_history — full audit trail for every payment
--
--   The existing `invoices` table is extended with a nullable subscription_id
--   FK so subscription-generated invoices are linked back to the subscription.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. PRICING PLANS
--    One row per named tier per external system.
--    `system`  — slug identifying the system (e.g. 'drais', 'lypha', 'consty')
--    `is_active` — only active plans are returned by the public pricing API
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pricing_plans (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100)  NOT NULL,                    -- e.g. 'Basic', 'Pro', 'Enterprise'
  system        VARCHAR(100)  NOT NULL,                    -- e.g. 'drais', 'lypha', 'consty'
  description   TEXT,
  features      JSONB         NOT NULL DEFAULT '[]'::JSONB, -- array of feature strings
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  display_order INT           NOT NULL DEFAULT 0,
  created_by    UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT pricing_plans_name_system_unique UNIQUE (name, system)
);

CREATE INDEX IF NOT EXISTS idx_pricing_plans_system   ON pricing_plans (system);
CREATE INDEX IF NOT EXISTS idx_pricing_plans_active   ON pricing_plans (system, is_active);

-- ---------------------------------------------------------------------------
-- 2. PRICING CYCLES
--    Each plan can have multiple billing cycles (monthly, termly, yearly…).
--    `duration_days` drives expiry calculation.
--    `price` + `currency` are the authoritative values – never hardcode these.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pricing_cycles (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID          NOT NULL REFERENCES pricing_plans(id) ON DELETE CASCADE,
  name          VARCHAR(50)   NOT NULL,            -- 'monthly', 'termly', 'yearly', 'custom'
  duration_days INT           NOT NULL CHECK (duration_days > 0),
  price         NUMERIC(14,2) NOT NULL CHECK (price >= 0),
  currency      VARCHAR(10)   NOT NULL DEFAULT 'UGX',
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT pricing_cycles_plan_name_unique UNIQUE (plan_id, name)
);

CREATE INDEX IF NOT EXISTS idx_pricing_cycles_plan ON pricing_cycles (plan_id);

-- ---------------------------------------------------------------------------
-- 3. SUBSCRIPTIONS
--    Per-client subscription record tracking the full lifecycle.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID          NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  plan_id           UUID          NOT NULL REFERENCES pricing_plans(id) ON DELETE RESTRICT,
  pricing_cycle_id  UUID          NOT NULL REFERENCES pricing_cycles(id) ON DELETE RESTRICT,
  system            VARCHAR(100)  NOT NULL,   -- denormalised for fast queries per system
  start_date        DATE          NOT NULL DEFAULT CURRENT_DATE,
  end_date          DATE          NOT NULL,
  status            VARCHAR(20)   NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','expired','suspended','cancelled','trial')),
  auto_renew        BOOLEAN       NOT NULL DEFAULT TRUE,
  notes             TEXT,
  created_by        UUID          REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at      TIMESTAMPTZ,
  cancelled_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_client  ON subscriptions (client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan    ON subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_system  ON subscriptions (system, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry  ON subscriptions (end_date, status);

-- ---------------------------------------------------------------------------
-- 4. SUBSCRIPTION BILLING HISTORY
--    Every payment / renewal event is recorded here for full audit trail.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_billing_history (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID          NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount          NUMERIC(14,2) NOT NULL,
  currency        VARCHAR(10)   NOT NULL DEFAULT 'UGX',
  event_type      VARCHAR(30)   NOT NULL
                  CHECK (event_type IN ('payment','renewal','upgrade','downgrade','refund','suspension','reactivation')),
  period_start    DATE          NOT NULL,
  period_end      DATE          NOT NULL,
  notes           TEXT,
  recorded_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
  recorded_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_billing_subscription ON subscription_billing_history (subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_billing_event        ON subscription_billing_history (event_type, recorded_at);

-- ---------------------------------------------------------------------------
-- 5. LINK EXISTING INVOICES TABLE TO SUBSCRIPTIONS (optional FK)
--    Only added when the column does not already exist.
-- ---------------------------------------------------------------------------
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices (subscription_id);

-- ---------------------------------------------------------------------------
-- 6. PERMISSIONS — pricing & subscription module
-- ---------------------------------------------------------------------------
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('pricing', 'view',               'View pricing plans and cycles',           '/app/pricing'),
  ('pricing', 'create',             'Create new pricing plans',                '/app/pricing'),
  ('pricing', 'update',             'Edit existing pricing plans and cycles',  '/app/pricing'),
  ('pricing', 'delete',             'Remove pricing plans',                    '/app/pricing'),
  ('subscriptions', 'view',         'View client subscriptions',               '/app/subscriptions'),
  ('subscriptions', 'create',       'Create new subscriptions',                '/app/subscriptions'),
  ('subscriptions', 'update',       'Update / renew subscriptions',            '/app/subscriptions'),
  ('subscriptions', 'cancel',       'Cancel subscriptions',                    '/app/subscriptions'),
  ('subscriptions', 'billing_view', 'View subscription billing history',       '/app/subscriptions')
ON CONFLICT (module, action) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. GRANT SUPERADMIN ALL PRICING + SUBSCRIPTION PERMISSIONS
-- ---------------------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'superadmin'
  AND p.module IN ('pricing', 'subscriptions')
ON CONFLICT DO NOTHING;

-- Grant admin view + update (not delete)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.module IN ('pricing', 'subscriptions')
  AND p.action NOT IN ('delete')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. UPDATED_AT TRIGGERS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pricing_plans_updated_at   ON pricing_plans;
CREATE TRIGGER trg_pricing_plans_updated_at
  BEFORE UPDATE ON pricing_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_pricing_cycles_updated_at  ON pricing_cycles;
CREATE TRIGGER trg_pricing_cycles_updated_at
  BEFORE UPDATE ON pricing_cycles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at   ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. SEED: EXAMPLE PLANS (safe to re-run — ON CONFLICT DO NOTHING)
-- ---------------------------------------------------------------------------
INSERT INTO pricing_plans (name, system, description, features, display_order) VALUES
  ('Basic',      'drais',  'Entry-level plan for Drais',
   '["Up to 5 users","Core features","Email support"]', 1),
  ('Pro',        'drais',  'Professional plan for Drais',
   '["Up to 20 users","Advanced analytics","Priority support","API access"]', 2),
  ('Enterprise', 'drais',  'Enterprise plan for Drais',
   '["Unlimited users","Custom integrations","Dedicated support","SLA"]', 3),
  ('Basic',      'consty',  'Entry-level Consty plan',
   '["Up to 3 users","Invoicing","Basic reports"]', 1),
  ('Pro',        'consty',  'Professional Consty plan',
   '["Up to 15 users","Full CRM","Advanced reports","Finance module"]', 2),
  ('Enterprise', 'consty',  'Full Consty platform access',
   '["Unlimited users","All modules","API access","Custom branding","SLA"]', 3)
ON CONFLICT (name, system) DO NOTHING;

-- Seed pricing cycles for drais plans
WITH plan AS (SELECT id FROM pricing_plans WHERE name = 'Basic' AND system = 'drais')
INSERT INTO pricing_cycles (plan_id, name, duration_days, price, currency)
SELECT plan.id, cycle.name, cycle.duration_days, cycle.price, 'UGX'
FROM plan, (VALUES
  ('monthly',  30,  150000),
  ('termly',   90,  400000),
  ('yearly',  365, 1440000)
) AS cycle(name, duration_days, price)
ON CONFLICT (plan_id, name) DO NOTHING;

WITH plan AS (SELECT id FROM pricing_plans WHERE name = 'Pro' AND system = 'drais')
INSERT INTO pricing_cycles (plan_id, name, duration_days, price, currency)
SELECT plan.id, cycle.name, cycle.duration_days, cycle.price, 'UGX'
FROM plan, (VALUES
  ('monthly',  30,  350000),
  ('termly',   90,  950000),
  ('yearly',  365, 3500000)
) AS cycle(name, duration_days, price)
ON CONFLICT (plan_id, name) DO NOTHING;

WITH plan AS (SELECT id FROM pricing_plans WHERE name = 'Enterprise' AND system = 'drais')
INSERT INTO pricing_cycles (plan_id, name, duration_days, price, currency)
SELECT plan.id, cycle.name, cycle.duration_days, cycle.price, 'UGX'
FROM plan, (VALUES
  ('monthly',  30,  800000),
  ('termly',   90, 2200000),
  ('yearly',  365, 8000000)
) AS cycle(name, duration_days, price)
ON CONFLICT (plan_id, name) DO NOTHING;

-- Seed pricing cycles for consty plans
WITH plan AS (SELECT id FROM pricing_plans WHERE name = 'Basic' AND system = 'consty')
INSERT INTO pricing_cycles (plan_id, name, duration_days, price, currency)
SELECT plan.id, cycle.name, cycle.duration_days, cycle.price, 'UGX'
FROM plan, (VALUES
  ('monthly',  30,  200000),
  ('termly',   90,  550000),
  ('yearly',  365, 2000000)
) AS cycle(name, duration_days, price)
ON CONFLICT (plan_id, name) DO NOTHING;

WITH plan AS (SELECT id FROM pricing_plans WHERE name = 'Pro' AND system = 'consty')
INSERT INTO pricing_cycles (plan_id, name, duration_days, price, currency)
SELECT plan.id, cycle.name, cycle.duration_days, cycle.price, 'UGX'
FROM plan, (VALUES
  ('monthly',  30,  500000),
  ('termly',   90, 1350000),
  ('yearly',  365, 5000000)
) AS cycle(name, duration_days, price)
ON CONFLICT (plan_id, name) DO NOTHING;

WITH plan AS (SELECT id FROM pricing_plans WHERE name = 'Enterprise' AND system = 'consty')
INSERT INTO pricing_cycles (plan_id, name, duration_days, price, currency)
SELECT plan.id, cycle.name, cycle.duration_days, cycle.price, 'UGX'
FROM plan, (VALUES
  ('monthly',  30, 1200000),
  ('termly',   90, 3200000),
  ('yearly',  365, 12000000)
) AS cycle(name, duration_days, price)
ON CONFLICT (plan_id, name) DO NOTHING;

COMMIT;
