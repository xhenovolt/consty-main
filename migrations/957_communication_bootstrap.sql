-- ============================================================================
-- Migration 957: Communication System Bootstrap
-- Creates ALL communication tables + missing user columns
-- Idempotent — safe to re-run
-- All user/staff references use UUID to match existing schema
-- ============================================================================

-- ── Missing user columns ──────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS hierarchy_level INT DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── 1. CONVERSATIONS TABLE ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'department')),
  name VARCHAR(255),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_archived BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  last_message_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(is_archived);

-- ── 2. CONVERSATION PARTICIPANTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  muted BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_part_conversation ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_part_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_part_active ON conversation_participants(is_active);

-- ── 3. MESSAGES TABLE ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  content TEXT,
  message_type VARCHAR(50) NOT NULL DEFAULT 'text' CHECK (
    message_type IN ('text', 'image', 'video', 'audio', 'file', 'call', 'system')
  ),
  media_url VARCHAR(500),
  media_type VARCHAR(100),
  media_size INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  edited_at TIMESTAMP,
  deleted_at TIMESTAMP,
  is_pinned BOOLEAN DEFAULT FALSE,
  reply_to_message_id UUID REFERENCES messages(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(deleted_at);

-- ── 4. MESSAGE STATUS (Read receipts) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'sent' CHECK (
    status IN ('sent', 'delivered', 'seen')
  ),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_msg_status_message ON message_status(message_id);
CREATE INDEX IF NOT EXISTS idx_msg_status_user ON message_status(user_id);

-- ── 5. CALLS TABLE ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_type VARCHAR(50) NOT NULL CHECK (call_type IN ('audio', 'video')),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  caller_id UUID NOT NULL REFERENCES users(id),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'ringing', 'in_progress', 'completed', 'declined', 'missed')
  ),
  participants_json JSONB,
  recording_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_calls_conversation ON calls(conversation_id);
CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_id);

-- ── 6. MEDIA PERMISSIONS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_type VARCHAR(100) NOT NULL UNIQUE,
  allowed BOOLEAN DEFAULT TRUE,
  max_size_mb INT DEFAULT 100,
  allowed_mimetypes TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id)
);

INSERT INTO media_permissions (file_type, allowed, max_size_mb, allowed_mimetypes)
VALUES
  ('image', TRUE, 50, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('video', TRUE, 500, ARRAY['video/mp4', 'video/webm', 'video/quicktime']),
  ('audio', TRUE, 200, ARRAY['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg']),
  ('document', TRUE, 100, ARRAY['application/pdf', 'application/msword']),
  ('spreadsheet', TRUE, 100, ARRAY['application/vnd.ms-excel'])
ON CONFLICT DO NOTHING;

-- ── 7. TYPING INDICATORS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS typing_indicators (
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  PRIMARY KEY(conversation_id, user_id)
);

-- ── 8. COMMUNICATION NOTIFICATIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communication_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  notification_type VARCHAR(50) NOT NULL,
  message_id UUID REFERENCES messages(id),
  call_id UUID REFERENCES calls(id),
  conversation_id UUID REFERENCES conversations(id),
  from_user_id UUID REFERENCES users(id),
  title TEXT,
  body TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comm_notif_user ON communication_notifications(user_id);

-- ── 9. COMMUNICATION AUDIT LOG ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communication_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  conversation_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comm_audit_user ON communication_audit_log(user_id);

-- ── 10. CALL PERMISSIONS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID,
  can_start_audio_calls BOOLEAN DEFAULT TRUE,
  can_start_video_calls BOOLEAN DEFAULT TRUE,
  can_record_calls BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 11. COMMUNICATION SETTINGS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communication_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO communication_settings (setting_key, setting_value)
VALUES
  ('audio_calls_enabled', '{"enabled": true}'::jsonb),
  ('video_calls_enabled', '{"enabled": true}'::jsonb),
  ('file_sharing_enabled', '{"enabled": true}'::jsonb),
  ('max_file_size_mb', '{"value": 25}'::jsonb),
  ('allowed_file_types', '{"types": ["pdf","jpg","png","doc","xls","mp4","mp3"]}'::jsonb),
  ('rate_limit_messages', '{"value": 30}'::jsonb),
  ('rate_limit_calls', '{"value": 10}'::jsonb),
  ('recording_enabled', '{"enabled": false}'::jsonb),
  ('screen_sharing_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT DO NOTHING;

-- ── 12. CALL LOGS (for WebRTC signaling) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  caller_id UUID NOT NULL REFERENCES users(id),
  call_type VARCHAR(50) DEFAULT 'audio',
  status VARCHAR(50) DEFAULT 'pending',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 13. CALL PARTICIPANTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  UNIQUE(call_id, user_id)
);
