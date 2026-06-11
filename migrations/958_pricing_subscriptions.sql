-- Migration 958: Create pricing_plans, pricing_cycles, and subscriptions tables
-- These are required by /api/pricing and /api/subscriptions endpoints

-- ============================================================
-- PRICING PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_plans (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  system        TEXT        NOT NULL,    -- e.g. 'drais', 'consty'
  description   TEXT,
  features      JSONB       DEFAULT '[]',
  display_order INTEGER     DEFAULT 0,
  is_active     BOOLEAN     DEFAULT TRUE,
  created_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_plans_system   ON pricing_plans(system);
CREATE INDEX IF NOT EXISTS idx_pricing_plans_is_active ON pricing_plans(is_active);

-- ============================================================
-- PRICING CYCLES (per-plan billing periods with prices)
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_cycles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID        NOT NULL REFERENCES pricing_plans(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,          -- e.g. 'Monthly', 'Annual'
  duration_days INTEGER     NOT NULL,          -- 30, 90, 365
  price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency      TEXT        DEFAULT 'UGX',
  is_active     BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_cycles_plan_id ON pricing_cycles(plan_id);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id          UUID        NOT NULL REFERENCES pricing_plans(id),
  pricing_cycle_id UUID        NOT NULL REFERENCES pricing_cycles(id),
  system           TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active','expired','cancelled')),
  start_date       DATE        NOT NULL,
  end_date         DATE        NOT NULL,
  auto_renew       BOOLEAN     DEFAULT TRUE,
  notes            TEXT,
  created_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status    ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_system    ON subscriptions(system);

-- ============================================================
-- updated_at auto-update trigger (reuse or create)
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pricing_plans_updated_at'
  ) THEN
    CREATE TRIGGER trg_pricing_plans_updated_at
      BEFORE UPDATE ON pricing_plans
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pricing_cycles_updated_at'
  ) THEN
    CREATE TRIGGER trg_pricing_cycles_updated_at
      BEFORE UPDATE ON pricing_cycles
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER trg_subscriptions_updated_at
      BEFORE UPDATE ON subscriptions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ============================================================
-- SEED: Drais and Consty base plans
-- ============================================================
INSERT INTO pricing_plans (name, system, description, features, display_order, is_active)
SELECT 'Drais Basic', 'drais', 'Essential DRAIS features for small teams', '["Up to 5 users","Core DRAIS modules","Email support"]', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM pricing_plans WHERE system = 'drais' AND name = 'Drais Basic');

INSERT INTO pricing_plans (name, system, description, features, display_order, is_active)
SELECT 'Drais Professional', 'drais', 'Full DRAIS suite for growing organisations', '["Unlimited users","All DRAIS modules","Priority support","Custom reports"]', 2, TRUE
WHERE NOT EXISTS (SELECT 1 FROM pricing_plans WHERE system = 'drais' AND name = 'Drais Professional');

INSERT INTO pricing_plans (name, system, description, features, display_order, is_active)
SELECT 'Consty Standard', 'consty', 'Consty CRM and invoicing for small businesses', '["Up to 3 users","Invoicing","Deals pipeline","Email support"]', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM pricing_plans WHERE system = 'consty' AND name = 'Consty Standard');

INSERT INTO pricing_plans (name, system, description, features, display_order, is_active)
SELECT 'Consty Enterprise', 'consty', 'Full Consty platform for enterprises', '["Unlimited users","All modules","DRAIS integration","Dedicated support"]', 2, TRUE
WHERE NOT EXISTS (SELECT 1 FROM pricing_plans WHERE system = 'consty' AND name = 'Consty Enterprise');

-- ============================================================
-- SEED: Pricing cycles for each plan
-- ============================================================
INSERT INTO pricing_cycles (plan_id, name, duration_days, price, currency, is_active)
SELECT p.id, 'Monthly', 30, 150000, 'UGX', TRUE
FROM pricing_plans p WHERE p.system = 'drais' AND p.name = 'Drais Basic'
AND NOT EXISTS (SELECT 1 FROM pricing_cycles pc WHERE pc.plan_id = p.id AND pc.name = 'Monthly');

INSERT INTO pricing_cycles (plan_id, name, duration_days, price, currency, is_active)
SELECT p.id, 'Annually', 365, 1500000, 'UGX', TRUE
FROM pricing_plans p WHERE p.system = 'drais' AND p.name = 'Drais Basic'
AND NOT EXISTS (SELECT 1 FROM pricing_cycles pc WHERE pc.plan_id = p.id AND pc.name = 'Annually');

INSERT INTO pricing_cycles (plan_id, name, duration_days, price, currency, is_active)
SELECT p.id, 'Monthly', 30, 350000, 'UGX', TRUE
FROM pricing_plans p WHERE p.system = 'drais' AND p.name = 'Drais Professional'
AND NOT EXISTS (SELECT 1 FROM pricing_cycles pc WHERE pc.plan_id = p.id AND pc.name = 'Monthly');

INSERT INTO pricing_cycles (plan_id, name, duration_days, price, currency, is_active)
SELECT p.id, 'Annually', 365, 3500000, 'UGX', TRUE
FROM pricing_plans p WHERE p.system = 'drais' AND p.name = 'Drais Professional'
AND NOT EXISTS (SELECT 1 FROM pricing_cycles pc WHERE pc.plan_id = p.id AND pc.name = 'Annually');

INSERT INTO pricing_cycles (plan_id, name, duration_days, price, currency, is_active)
SELECT p.id, 'Monthly', 30, 100000, 'UGX', TRUE
FROM pricing_plans p WHERE p.system = 'consty' AND p.name = 'Consty Standard'
AND NOT EXISTS (SELECT 1 FROM pricing_cycles pc WHERE pc.plan_id = p.id AND pc.name = 'Monthly');

INSERT INTO pricing_cycles (plan_id, name, duration_days, price, currency, is_active)
SELECT p.id, 'Annually', 365, 1000000, 'UGX', TRUE
FROM pricing_plans p WHERE p.system = 'consty' AND p.name = 'Consty Standard'
AND NOT EXISTS (SELECT 1 FROM pricing_cycles pc WHERE pc.plan_id = p.id AND pc.name = 'Annually');

INSERT INTO pricing_cycles (plan_id, name, duration_days, price, currency, is_active)
SELECT p.id, 'Monthly', 30, 250000, 'UGX', TRUE
FROM pricing_plans p WHERE p.system = 'consty' AND p.name = 'Consty Enterprise'
AND NOT EXISTS (SELECT 1 FROM pricing_cycles pc WHERE pc.plan_id = p.id AND pc.name = 'Monthly');

INSERT INTO pricing_cycles (plan_id, name, duration_days, price, currency, is_active)
SELECT p.id, 'Annually', 365, 2500000, 'UGX', TRUE
FROM pricing_plans p WHERE p.system = 'consty' AND p.name = 'Consty Enterprise'
AND NOT EXISTS (SELECT 1 FROM pricing_cycles pc WHERE pc.plan_id = p.id AND pc.name = 'Annually');
