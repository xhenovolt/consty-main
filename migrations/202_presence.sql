-- Migration 202: User Presence System
-- Implements real-time user presence tracking via heartbeat signals
-- A user is "online" if now() - last_ping < 60 seconds

CREATE TABLE IF NOT EXISTS user_presence (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_ping   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status      VARCHAR(20)  NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline'))
);

-- Index for fast "who is online" queries
CREATE INDEX IF NOT EXISTS idx_user_presence_last_ping ON user_presence (last_ping DESC);
CREATE INDEX IF NOT EXISTS idx_user_presence_status    ON user_presence (status);

-- Function: update online status based on last_ping staleness
CREATE OR REPLACE FUNCTION refresh_user_presence_status()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE user_presence
  SET status = CASE
    WHEN NOW() - last_ping < INTERVAL '60 seconds' THEN 'online'
    ELSE 'offline'
  END;
END;
$$;

COMMENT ON TABLE user_presence IS 'Tracks real-time user online/offline status via heartbeat pings';
COMMENT ON COLUMN user_presence.last_ping IS 'Timestamp of most recent heartbeat from the client';
COMMENT ON COLUMN user_presence.last_seen IS 'Timestamp of last confirmed activity (same as last_ping while online)';
COMMENT ON COLUMN user_presence.status IS 'Computed status: online if last_ping < 60s ago, otherwise offline';
