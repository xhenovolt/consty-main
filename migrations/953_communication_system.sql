-- ============================================================================
-- Migration 953: DRAIS Communication System
-- ============================================================================
-- Full internal messaging platform replacing WhatsApp
-- ============================================================================

-- ============================================================================
-- 1. CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL CHECK (type IN ('direct', 'group', 'department')),
  name VARCHAR(255),  -- NULL for direct conversations
  created_by INT NOT NULL REFERENCES staff(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_archived BOOLEAN DEFAULT FALSE,
  last_message_at TIMESTAMP
);

CREATE INDEX idx_conversations_type ON conversations(type);
CREATE INDEX idx_conversations_created_by ON conversations(created_by);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
CREATE INDEX idx_conversations_archived ON conversations(is_archived);

-- ============================================================================
-- 2. CONVERSATION PARTICIPANTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_participants (
  id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  muted BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_conv_part_conversation ON conversation_participants(conversation_id);
CREATE INDEX idx_conv_part_user ON conversation_participants(user_id);
CREATE INDEX idx_conv_part_active ON conversation_participants(is_active);

-- ============================================================================
-- 3. MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INT NOT NULL REFERENCES users(id),
  content TEXT,
  message_type VARCHAR(50) NOT NULL DEFAULT 'text' CHECK (
    message_type IN ('text', 'image', 'video', 'audio', 'file', 'call', 'system')
  ),
  media_url VARCHAR(500),  -- Cloudinary URL
  media_type VARCHAR(100),
  media_size INT,  -- Bytes
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  edited_at TIMESTAMP,
  deleted_at TIMESTAMP,
  is_pinned BOOLEAN DEFAULT FALSE,
  reply_to_message_id INT REFERENCES messages(id)
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_type ON messages(message_type);
CREATE INDEX idx_messages_deleted ON messages(deleted_at);

-- ============================================================================
-- 4. MESSAGE STATUS TABLE (Read receipts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_status (
  id SERIAL PRIMARY KEY,
  message_id INT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'sent' CHECK (
    status IN ('sent', 'delivered', 'seen')
  ),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id)
);

CREATE INDEX idx_msg_status_message ON message_status(message_id);
CREATE INDEX idx_msg_status_user ON message_status(user_id);
CREATE INDEX idx_msg_status_status ON message_status(status);

-- ============================================================================
-- 5. CALLS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS calls (
  id SERIAL PRIMARY KEY,
  call_type VARCHAR(50) NOT NULL CHECK (call_type IN ('audio', 'video')),
  conversation_id INT NOT NULL REFERENCES conversations(id),
  caller_id INT NOT NULL REFERENCES users(id),
  
  -- Call timing
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INT,  -- Calculated
  
  -- Call state
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'ringing', 'in_progress', 'completed', 'declined', 'missed')
  ),
  
  -- Participants
  participants_json JSONB,  -- Array of {user_id, joined_at, left_at}
  
  -- Recording
  recording_url VARCHAR(500),  -- Cloudinary URL
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB  -- Extra info like mute/unmute events
);

CREATE INDEX idx_calls_conversation ON calls(conversation_id);
CREATE INDEX idx_calls_caller ON calls(caller_id);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_created_at ON calls(created_at);
CREATE INDEX idx_calls_call_type ON calls(call_type);

-- ============================================================================
-- 6. MEDIA PERMISSIONS TABLE (Admin control)
-- ============================================================================
CREATE TABLE IF NOT EXISTS media_permissions (
  id SERIAL PRIMARY KEY,
  file_type VARCHAR(100) NOT NULL UNIQUE,  -- 'image', 'video', 'audio', 'document', 'pdf'
  allowed BOOLEAN DEFAULT TRUE,
  max_size_mb INT DEFAULT 100,
  allowed_mimetypes TEXT[],  -- Array of mime types
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INT REFERENCES users(id)
);

-- Insert default media types
INSERT INTO media_permissions (file_type, allowed, max_size_mb, allowed_mimetypes)
VALUES
  ('image', TRUE, 50, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('video', TRUE, 500, ARRAY['video/mp4', 'video/webm', 'video/quicktime']),
  ('audio', TRUE, 200, ARRAY['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg']),
  ('document', TRUE, 100, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('spreadsheet', TRUE, 100, ARRAY['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT DO NOTHING;

CREATE INDEX idx_media_perm_type ON media_permissions(file_type) WHERE allowed = TRUE;

-- ============================================================================
-- 7. USER PRESENCE TABLE (Online/Offline status)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_presence (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMP,
  current_conversation_id INT,
  device_type VARCHAR(50),  -- 'web', 'mobile', 'desktop'
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_presence_user ON user_presence(user_id);
CREATE INDEX idx_presence_online ON user_presence(is_online);

-- ============================================================================
-- 8. TYPING INDICATORS TABLE (Real-time)
-- ============================================================================
CREATE TABLE IF NOT EXISTS typing_indicators (
  id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES conversations(id),
  user_id INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,  -- Expire typing indicator after 3s
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_typing_conversation ON typing_indicators(conversation_id);
CREATE INDEX idx_typing_expires ON typing_indicators(expires_at);

-- ============================================================================
-- 9. CALL PERMISSIONS TABLE (Admin control)
-- ============================================================================
CREATE TABLE IF NOT EXISTS call_permissions (
  id SERIAL PRIMARY KEY,
  role_id INT NOT NULL REFERENCES roles(id),
  can_start_audio_calls BOOLEAN DEFAULT TRUE,
  can_start_video_calls BOOLEAN DEFAULT TRUE,
  can_record_calls BOOLEAN DEFAULT FALSE,
  max_call_duration_minutes INT,  -- NULL = unlimited
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id)
);

CREATE INDEX idx_call_perm_role ON call_permissions(role_id);

-- ============================================================================
-- 10. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS communication_notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification type
  notification_type VARCHAR(100) NOT NULL,  -- 'message', 'call', 'missed_call', etc.
  
  -- Related entity
  message_id INT REFERENCES messages(id),
  call_id INT REFERENCES calls(id),
  conversation_id INT REFERENCES conversations(id),
  from_user_id INT REFERENCES users(id),
  
  -- Content
  title VARCHAR(255),
  body TEXT,
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX idx_notif_user ON communication_notifications(user_id);
CREATE INDEX idx_notif_read ON communication_notifications(is_read);
CREATE INDEX idx_notif_type ON communication_notifications(notification_type);
CREATE INDEX idx_notif_created ON communication_notifications(created_at);

-- ============================================================================
-- 11. AUDIT LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS communication_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action VARCHAR(100),  -- 'message_sent', 'message_deleted', 'call_started', etc.
  entity_type VARCHAR(100),  -- 'message', 'conversation', 'call'
  entity_id INT,
  conversation_id INT REFERENCES conversations(id),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON communication_audit_log(user_id);
CREATE INDEX idx_audit_action ON communication_audit_log(action);
CREATE INDEX idx_audit_entity ON communication_audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON communication_audit_log(created_at);

-- ============================================================================
-- 12. CONVERSATION SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_settings (
  id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL UNIQUE REFERENCES conversations(id),
  allow_file_sharing BOOLEAN DEFAULT TRUE,
  allow_calls BOOLEAN DEFAULT TRUE,
  allow_video_calls BOOLEAN DEFAULT TRUE,
  auto_delete_messages BOOLEAN DEFAULT FALSE,
  auto_delete_days INT,  -- NULL = never
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conv_settings_conversation ON conversation_settings(conversation_id);

-- ============================================================================
-- Add RBAC Permissions for Communication Module
-- ============================================================================
INSERT INTO permissions (module, action, name, description, route_path, method)
VALUES
  ('communication', 'view_conversations', 'View Conversations', 'View list of conversations', '/api/communication/conversations', 'GET'),
  ('communication', 'create_conversation', 'Create Conversation', 'Create direct or group conversation', '/api/communication/conversations', 'POST'),
  ('communication', 'delete_conversation', 'Delete Conversation', 'Delete a conversation', '/api/communication/conversations/:id', 'DELETE'),
  ('communication', 'send_message', 'Send Message', 'Send or reply to message', '/api/communication/messages', 'POST'),
  ('communication', 'edit_message', 'Edit Message', 'Edit own message', '/api/communication/messages/:id', 'PUT'),
  ('communication', 'delete_message', 'Delete Message', 'Delete own message', '/api/communication/messages/:id', 'DELETE'),
  ('communication', 'manage_participants', 'Manage Participants', 'Add/remove users from conversation', '/api/communication/participants', 'POST'),
  ('communication', 'start_call', 'Start Call', 'Initiate audio or video call', '/api/communication/calls', 'POST'),
  ('communication', 'manage_permissions', 'Manage Permissions', 'Control file types and call permissions', '/api/communication/permissions', 'GET'),
  ('communication', 'view_all_conversations', 'View All Conversations', 'Admin: view all conversations', '/api/communication/conversations/admin', 'POST'),
  ('communication', 'manage_media_permissions', 'Manage Media Permissions', 'Admin: control file types', '/api/communication/permissions/media', 'PUT'),
  ('communication', 'manage_call_permissions', 'Manage Call Permissions', 'Admin: control call features', '/api/communication/permissions/calls', 'PUT')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Assign Permissions to Roles
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('Staff', 'Manager', 'Admin', 'Superadmin')
  AND p.module = 'communication'
  AND p.action IN (
    'view_conversations',
    'create_conversation',
    'send_message',
    'edit_message',
    'delete_message',
    'manage_participants',
    'start_call'
  )
ON CONFLICT DO NOTHING;

-- Admin-only permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('Admin', 'Superadmin')
  AND p.module = 'communication'
  AND p.action IN (
    'manage_media_permissions',
    'manage_call_permissions',
    'view_all_conversations'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Create Indexes for Performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_part_conversation_active ON conversation_participants(conversation_id, is_active);
CREATE INDEX IF NOT EXISTS idx_msg_status_message_status ON message_status(message_id, status);

-- ============================================================================
-- Summary
-- ============================================================================
-- Tables created: 12
-- 1. conversations
-- 2. conversation_participants
-- 3. messages
-- 4. message_status
-- 5. calls
-- 6. media_permissions
-- 7. user_presence
-- 8. typing_indicators
-- 9. call_permissions
-- 10. communication_notifications
-- 11. communication_audit_log
-- 12. conversation_settings
--
-- This provides a complete, production-ready communication system with:
-- - Direct and group messaging
-- - Real-time presence and typing indicators
-- - Audio/video calls with recording
-- - Read receipts and message status
-- - Media permissions management
-- - Call permissions by role
-- - Comprehensive audit logging
-- - Full RBAC integration
-- ============================================================================
