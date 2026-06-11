-- Migration 034: Event-Driven Architecture
-- Adds a global events table as the company's historical ledger.
-- All modules emit events here, enabling unified activity feed and auditing.

CREATE TABLE IF NOT EXISTS events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type  VARCHAR(64)   NOT NULL,  -- e.g. system_created, deal_closed
  entity_type VARCHAR(64),             -- e.g. system, deal, payment, issue
  entity_id   UUID,                    -- FK-style reference (no hard constraint for flexibility)
  description TEXT,
  metadata    JSONB         DEFAULT '{}',
  created_by  UUID,                    -- references users.id loosely
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- Performance indexes as required by Part 11
CREATE INDEX IF NOT EXISTS idx_events_event_type  ON events (event_type);
CREATE INDEX IF NOT EXISTS idx_events_entity_id   ON events (entity_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at  ON events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_entity_type ON events (entity_type);

-- Composite index for entity timelines (entity_type + entity_id + created_at)
CREATE INDEX IF NOT EXISTS idx_events_timeline
  ON events (entity_type, entity_id, created_at DESC);
