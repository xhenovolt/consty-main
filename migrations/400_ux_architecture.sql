-- =============================================================================
-- MIGRATION 400: Consty UX Architecture — Event System, Notifications, Health, Jobs
-- Date: 2026-03-11
-- =============================================================================

-- =============================================================================
-- 1. SYSTEM EVENTS — Central event log powering notifications + activity
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_name VARCHAR(100) NOT NULL,           -- e.g. 'prospect_created', 'deal_payment_recorded'
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(50),                    -- e.g. 'prospect', 'deal', 'payment', 'asset'
  entity_id UUID,
  description TEXT,                           -- Human-readable summary
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_events_name ON system_events(event_name);
CREATE INDEX IF NOT EXISTS idx_system_events_actor ON system_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_system_events_entity ON system_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_system_events_created ON system_events(created_at DESC);

-- =============================================================================
-- 2. NOTIFICATIONS — Powered by system events
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES system_events(id) ON DELETE SET NULL,
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info',   -- info, success, warning, alert
  title VARCHAR(255) NOT NULL,
  message TEXT,
  reference_type VARCHAR(50),                 -- e.g. 'deal', 'prospect'
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_type, reference_id);

-- =============================================================================
-- 3. SYSTEM HEALTH LOGS — Observability
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_health_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  component VARCHAR(100) NOT NULL,            -- e.g. 'api/deals', 'database', 'auth'
  status VARCHAR(20) NOT NULL DEFAULT 'error', -- ok, warning, error
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_logs_component ON system_health_logs(component, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_logs_status ON system_health_logs(status, created_at DESC);

-- =============================================================================
-- 4. SYSTEM JOBS — Background job queue
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type VARCHAR(100) NOT NULL,             -- e.g. 'send_notification', 'update_analytics'
  payload JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON system_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON system_jobs(job_type, status);

-- =============================================================================
-- 5. ADDITIONAL INDEXES for performance at scale
-- =============================================================================

-- Prospects performance
CREATE INDEX IF NOT EXISTS idx_prospects_stage ON prospects(stage);
CREATE INDEX IF NOT EXISTS idx_prospects_created ON prospects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_company ON prospects(company_name);

-- Deals performance
CREATE INDEX IF NOT EXISTS idx_deals_status_created ON deals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_client ON deals(client_id);
CREATE INDEX IF NOT EXISTS idx_deals_created ON deals(created_at DESC);

-- Operations performance
CREATE INDEX IF NOT EXISTS idx_operations_created ON operations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operations_type ON operations(operation_type);

-- Expenses performance
CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category_date ON expenses(category, expense_date DESC);

-- Events (existing) performance
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id);

-- Audit logs performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- =============================================================================
-- 6. IDEMPOTENCY KEYS — Prevent duplicate submissions
-- =============================================================================

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-cleanup old keys (older than 24h) via index for efficient deletion
CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys(created_at);
