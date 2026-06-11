-- =============================================================================
-- MIGRATION 943: CRITICAL SYSTEM FIXES
-- Presence rebuild, operations fix, device tracking, system_logs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. FIX OPERATIONS: description was NOT NULL — allow null / add default
-- -----------------------------------------------------------------------------
ALTER TABLE operations ALTER COLUMN description DROP NOT NULL;
ALTER TABLE operations ALTER COLUMN description SET DEFAULT 'No description provided';

-- Back-fill any NULLs that may already be in the table
UPDATE operations
  SET description = COALESCE(NULLIF(TRIM(title), ''), 'No description provided')
  WHERE description IS NULL;

-- Add lifecycle timing columns
ALTER TABLE operations ADD COLUMN IF NOT EXISTS started_at    TIMESTAMPTZ;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS completed_at  TIMESTAMPTZ;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS duration      INTEGER; -- minutes (auto-calculated when completed_at is set)

-- -----------------------------------------------------------------------------
-- 2. PRESENCE: Add last_seen_at & session_id to users for source-of-truth
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_id   TEXT;

-- Migrate existing last_seen → last_seen_at
UPDATE users SET last_seen_at = last_seen WHERE last_seen IS NOT NULL AND last_seen_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_last_seen_at ON users(last_seen_at DESC);

-- -----------------------------------------------------------------------------
-- 3. PRESENCE TABLE: Ensure all required columns + correct status check
-- -----------------------------------------------------------------------------
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS current_route       TEXT;
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS current_page_title  TEXT;
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS device_info         TEXT;
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS ip_address          VARCHAR(45);
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS user_agent          TEXT;
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW();

-- Ensure 'away' is in the allowed status values
ALTER TABLE user_presence DROP CONSTRAINT IF EXISTS user_presence_status_check;
ALTER TABLE user_presence
  ADD CONSTRAINT user_presence_status_check
  CHECK (status IN ('online', 'away', 'offline'));

-- Back-fill updated_at
UPDATE user_presence SET updated_at = COALESCE(last_seen, last_ping, NOW()) WHERE updated_at IS NULL;

-- -----------------------------------------------------------------------------
-- 4. SESSIONS: Add browser & os columns for proper device display
-- -----------------------------------------------------------------------------
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS browser VARCHAR(100);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS os      VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_sessions_browser ON sessions(browser);

-- -----------------------------------------------------------------------------
-- 5. SYSTEM LOGS TABLE — centralised error + event logging
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_logs (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  level      VARCHAR(20)  NOT NULL DEFAULT 'error'
               CHECK (level IN ('info', 'warn', 'error', 'critical')),
  module     VARCHAR(100),
  action     VARCHAR(100),
  message    TEXT         NOT NULL,
  details    JSONB,
  user_id    UUID         REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(100),
  entity_id   UUID,
  ip_address  VARCHAR(45),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level      ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_module     ON system_logs(module);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id    ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

-- -----------------------------------------------------------------------------
-- 6. LICENSES: Ensure needed fields exist and deal auto-issue works
-- -----------------------------------------------------------------------------
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS client_id   UUID REFERENCES clients(id)  ON DELETE SET NULL;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS plan_id     UUID REFERENCES system_pricing_plans(id) ON DELETE SET NULL;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS auto_issued BOOLEAN DEFAULT false;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS issue_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_licenses_client_id ON licenses(client_id);
CREATE INDEX IF NOT EXISTS idx_licenses_plan_id   ON licenses(plan_id);
CREATE INDEX IF NOT EXISTS idx_licenses_deal_id   ON licenses(deal_id);

-- -----------------------------------------------------------------------------
-- 7. DEPARTMENTS: Track active staff count at delete time (soft-delete safe)
-- -----------------------------------------------------------------------------
-- The safety check is handled in the backend; no schema change needed here.
-- But let's add a soft-delete_reason column for audit trails.
ALTER TABLE departments ADD COLUMN IF NOT EXISTS deleted_reason    TEXT;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS deactivated_at    TIMESTAMPTZ;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS deactivated_by    UUID REFERENCES users(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 8. STAFF: Ensure proper relational fields exist
-- -----------------------------------------------------------------------------
ALTER TABLE staff ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS role_id     UUID REFERENCES roles(id) ON DELETE SET NULL;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_staff_user_id       ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_department_id ON staff(department_id);

-- -----------------------------------------------------------------------------
-- 9. PRESENCE TRIGGER: Auto-update user_presence.status from last_ping
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_presence_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.status =
    CASE
      WHEN NOW() - NEW.last_ping < INTERVAL '60 seconds'  THEN 'online'
      WHEN NOW() - NEW.last_ping < INTERVAL '5 minutes'   THEN 'away'
      ELSE 'offline'
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refresh_presence_status ON user_presence;
CREATE TRIGGER trg_refresh_presence_status
  BEFORE INSERT OR UPDATE OF last_ping ON user_presence
  FOR EACH ROW
  EXECUTE FUNCTION refresh_presence_status();

-- -----------------------------------------------------------------------------
-- 10. AUDIT: Ensure audit_logs covers system_logs fallback
-- -----------------------------------------------------------------------------
-- (audit_logs already exists; no schema changes needed)

-- Mark migration complete
DO $$
BEGIN
  RAISE NOTICE 'Migration 943 applied: critical fixes for presence, operations, device tracking, system_logs, departments, licenses, staff.';
END;
$$;
