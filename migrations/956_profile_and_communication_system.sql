-- Migration: Profile System Enhancement
-- Adds profile features: profile images, avatars, cover photos, activity tracking, device tracking

-- Profile fields on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_device TEXT;

-- Activity log table (deep activity timeline)
CREATE TABLE IF NOT EXISTS user_activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_log_user ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_created ON user_activity_log(created_at DESC);

-- User devices table
CREATE TABLE IF NOT EXISTS user_devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT,
  browser TEXT,
  os TEXT,
  ip_address TEXT,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_current BOOLEAN DEFAULT false,
  UNIQUE(user_id, browser, os, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id);

-- Communication permissions table (for admin controls)
CREATE TABLE IF NOT EXISTS communication_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}',
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default communication settings
INSERT INTO communication_settings (setting_key, setting_value) VALUES
  ('audio_calls_enabled', '{"enabled": true}'),
  ('video_calls_enabled', '{"enabled": true}'),
  ('file_sharing_enabled', '{"enabled": true}'),
  ('max_file_size_mb', '{"value": 25}'),
  ('allowed_file_types', '{"types": ["image/*", "video/*", "audio/*", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.*", "text/*"]}'),
  ('rate_limit_messages', '{"max_per_minute": 30}'),
  ('rate_limit_calls', '{"max_per_hour": 10}'),
  ('recording_enabled', '{"enabled": false}'),
  ('screen_sharing_enabled', '{"enabled": true}')
ON CONFLICT (setting_key) DO NOTHING;

-- Call logs table (for WebRTC calls)
CREATE TABLE IF NOT EXISTS call_logs (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER,
  caller_id INTEGER NOT NULL REFERENCES users(id),
  call_type TEXT NOT NULL DEFAULT 'audio' CHECK (call_type IN ('audio', 'video', 'screen_share')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'ended', 'missed', 'declined', 'failed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  recording_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON call_logs(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_conversation ON call_logs(conversation_id);

-- Call participants
CREATE TABLE IF NOT EXISTS call_participants (
  id SERIAL PRIMARY KEY,
  call_id INTEGER NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  role TEXT DEFAULT 'participant' CHECK (role IN ('host', 'participant')),
  UNIQUE(call_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_call_participants_call ON call_participants(call_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_user ON call_participants(user_id);
