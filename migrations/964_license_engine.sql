-- Migration 964: License Engine — full lifecycle, activations, devices, domains, events, renewals, features, audit
-- Phase 1 of enterprise hardening. Idempotent.

-- ============================================================
-- 1. EXTEND `licenses` with lifecycle + entitlement columns
-- ============================================================
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS subscription_id UUID;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS activated_at      TIMESTAMPTZ;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS suspended_at      TIMESTAMPTZ;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS suspended_reason  TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS revoked_at        TIMESTAMPTZ;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS revoked_reason    TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS expires_at        TIMESTAMPTZ;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS max_devices       INTEGER;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS installation_type VARCHAR(20)
  CHECK (installation_type IS NULL OR installation_type IN ('cloud','onpremise','hybrid'));
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS support_level     VARCHAR(20)
  CHECK (support_level IS NULL OR support_level IN ('none','basic','standard','priority','enterprise'));
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS metadata          JSONB DEFAULT '{}'::jsonb;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS allowed_domains   TEXT[];
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS activation_token  VARCHAR(128);

-- Drop the existing CHECK constraint on status if too narrow, then re-create with extended set.
-- We do this defensively because the original table allowed only ('active','expired','suspended','revoked').
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'licenses'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE 'ALTER TABLE licenses DROP CONSTRAINT IF EXISTS ' || quote_ident(c.conname);
  END LOOP;
END $$;

ALTER TABLE licenses ADD CONSTRAINT licenses_status_check CHECK (
  status IN ('pending','trial','active','suspended','expired','revoked','transferred')
);

-- Make license_key unique when present
CREATE UNIQUE INDEX IF NOT EXISTS uq_licenses_license_key
  ON licenses(license_key) WHERE license_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_licenses_expires_at      ON licenses(expires_at);
CREATE INDEX IF NOT EXISTS idx_licenses_subscription_id ON licenses(subscription_id);
CREATE INDEX IF NOT EXISTS idx_licenses_activated_at    ON licenses(activated_at);

-- Add FK to subscriptions if that table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions')
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_licenses_subscription_id'
     ) THEN
    ALTER TABLE licenses
      ADD CONSTRAINT fk_licenses_subscription_id
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 2. license_activations — every issuance / activation attempt
-- ============================================================
CREATE TABLE IF NOT EXISTS license_activations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id      UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  activation_token VARCHAR(128) NOT NULL,
  activated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  activated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address      INET,
  user_agent      TEXT,
  device_id       UUID,
  status          VARCHAR(20) NOT NULL DEFAULT 'success'
    CHECK (status IN ('success','failed','revoked')),
  failure_reason  TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_license_activations_license_id ON license_activations(license_id);
CREATE INDEX IF NOT EXISTS idx_license_activations_activated_at ON license_activations(activated_at DESC);

-- ============================================================
-- 3. license_devices — registered devices/installations
-- ============================================================
CREATE TABLE IF NOT EXISTS license_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id      UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  device_fingerprint VARCHAR(255) NOT NULL,
  device_name     VARCHAR(255),
  os              VARCHAR(64),
  hostname        VARCHAR(255),
  ip_address      INET,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_license_devices_fingerprint
  ON license_devices(license_id, device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_license_devices_license_id ON license_devices(license_id);

-- ============================================================
-- 4. license_domains — allowed domains per license
-- ============================================================
CREATE TABLE IF NOT EXISTS license_domains (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id      UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  domain          VARCHAR(255) NOT NULL,
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at     TIMESTAMPTZ,
  added_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_license_domains
  ON license_domains(license_id, domain);

-- ============================================================
-- 5. license_events — full lifecycle event stream
-- ============================================================
CREATE TABLE IF NOT EXISTS license_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id      UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  event_type      VARCHAR(40) NOT NULL,
  -- issued | activated | suspended | resumed | renewed | upgraded | downgraded
  -- transferred | revoked | expired | device_registered | domain_added | feature_changed
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  description     TEXT,
  before_state    JSONB,
  after_state     JSONB,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_license_events_license_id ON license_events(license_id);
CREATE INDEX IF NOT EXISTS idx_license_events_event_type ON license_events(event_type);
CREATE INDEX IF NOT EXISTS idx_license_events_created_at ON license_events(created_at DESC);

-- ============================================================
-- 6. license_renewals — renewal history
-- ============================================================
CREATE TABLE IF NOT EXISTS license_renewals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id      UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  previous_expires_at TIMESTAMPTZ,
  new_expires_at  TIMESTAMPTZ NOT NULL,
  duration_days   INTEGER,
  amount          NUMERIC(15,2),
  currency        VARCHAR(3) DEFAULT 'UGX',
  payment_id      UUID,
  renewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_license_renewals_license_id ON license_renewals(license_id);

-- ============================================================
-- 7. license_feature_access — per-license feature toggles
-- ============================================================
CREATE TABLE IF NOT EXISTS license_feature_access (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id      UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  feature_key     VARCHAR(100) NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  limit_value     INTEGER,
  notes           TEXT,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_license_feature_access
  ON license_feature_access(license_id, feature_key);

-- ============================================================
-- 8. license_audit_logs — security/audit trail (separate from events)
-- ============================================================
CREATE TABLE IF NOT EXISTS license_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id      UUID REFERENCES licenses(id) ON DELETE SET NULL,
  action          VARCHAR(50) NOT NULL,
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address      INET,
  user_agent      TEXT,
  details         JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_license_audit_logs_license_id ON license_audit_logs(license_id);
CREATE INDEX IF NOT EXISTS idx_license_audit_logs_created_at ON license_audit_logs(created_at DESC);

-- ============================================================
-- 9. Permissions: extend RBAC for granular license actions
-- ============================================================
INSERT INTO permissions (module, action, description, route_path)
VALUES
  ('licenses','issue',     'Issue new licenses',         '/api/licenses'),
  ('licenses','activate',  'Activate licenses',          '/api/licenses'),
  ('licenses','suspend',   'Suspend licenses',           '/api/licenses'),
  ('licenses','revoke',    'Revoke licenses',            '/api/licenses'),
  ('licenses','renew',     'Renew licenses',             '/api/licenses'),
  ('licenses','transfer',  'Transfer licenses',          '/api/licenses')
ON CONFLICT DO NOTHING;
