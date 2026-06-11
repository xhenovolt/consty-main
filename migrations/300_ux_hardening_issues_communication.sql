-- ============================================================================
-- CONSTY UX HARDENING - SYSTEMS ARCHITECTURE
-- Migration 300: Auto-Issue Logging, Notifications, Real-time Communication
-- Date: 2026-03-25
-- 
-- SYSTEMS IMPLEMENTED:
--   1. Auto-Issue Logging: Captures system errors automatically
--   2. Notification System: Real-time user notifications
--   3. Communication Module: Internal messaging (chat, direct/group)
--   4. Unified Issue Tracking: Single source of truth for all issues
-- ============================================================================

-- ============================================================================
-- 1. ISSUES TABLE (Auto-logged errors + manual reports)
-- ============================================================================

CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_id VARCHAR(100) NOT NULL DEFAULT 'Consty',  -- Which system reported this
  title VARCHAR(500) NOT NULL,                       -- Error message or issue title
  description TEXT,                                  -- Full error stack trace or details
  severity VARCHAR(50) NOT NULL DEFAULT 'medium'    -- critical, high, medium, low
    CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  source VARCHAR(50) NOT NULL DEFAULT 'manual'       -- 'manual' or 'auto'
    CHECK (source IN ('manual', 'auto', 'user-report')),
  status VARCHAR(50) NOT NULL DEFAULT 'open'         -- open, assigned, in-progress, resolved, closed
    CHECK (status IN ('open', 'assigned', 'in-progress', 'resolved', 'closed')),
  reported_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  error_code VARCHAR(50),                            -- e.g., "ERR_MAP_NOT_FUNC"
  error_stack TEXT,                                  -- Full JavaScript stack trace
  context JSONB DEFAULT '{}',                        -- Additional context (URL, browser, etc)
  resolution_notes TEXT,                             -- How was it fixed?
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,                           -- When was it marked resolved
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_severity ON issues(severity);
CREATE INDEX idx_issues_source ON issues(source);
CREATE INDEX idx_issues_system_id ON issues(system_id);
CREATE INDEX idx_issues_created_at ON issues(created_at DESC);
CREATE INDEX idx_issues_resolved_at ON issues(resolved_at);

-- ============================================================================
-- 2. NOTIFICATIONS TABLE (Real-time user alerts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info'           -- info, warning, error, success, issue
    CHECK (type IN ('info', 'warning', 'error', 'success', 'issue', 'message')),
  reference_type VARCHAR(100),                       -- 'issue', 'deal', 'payment', 'message', etc
  reference_id UUID,                                 -- ID of referenced entity
  is_read BOOLEAN NOT NULL DEFAULT false,
  action_url VARCHAR(500),                           -- URL to navigate to
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_reference ON notifications(reference_type, reference_id);

-- ============================================================================
-- 3. CONVERSATIONS TABLE (Direct messages & group chats)
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL DEFAULT 'direct'         -- 'direct' or 'group'
    CHECK (type IN ('direct', 'group')),
  name VARCHAR(255),                                 -- Name for group chats (null for direct)
  description TEXT,                                  -- Group description
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  avatar_url VARCHAR(500),                           -- Group avatar
  is_archived BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ,                       -- Denormalized for sorting
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_type ON conversations(type);
CREATE INDEX idx_conversations_created_by ON conversations(created_by_user_id);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC NULLS LAST);
CREATE INDEX idx_conversations_archived ON conversations(is_archived);

-- ============================================================================
-- 4. CONVERSATION MEMBERS TABLE (Link users to conversations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member'         -- 'owner', 'admin', 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,                               -- NULL if still member
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_conversation_members_conversation_id ON conversation_members(conversation_id);
CREATE INDEX idx_conversation_members_user_id ON conversation_members(user_id);
CREATE UNIQUE INDEX idx_conversation_members_unique ON conversation_members(conversation_id, user_id) 
  WHERE left_at IS NULL AND is_active;

-- ============================================================================
-- 5. MESSAGES TABLE (Chat messages with delivery status)
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type VARCHAR(50) NOT NULL DEFAULT 'text'   -- 'text', 'image', 'file', 'system'
    CHECK (message_type IN ('text', 'image', 'file', 'system')),
  -- Media attachment info
  media_url VARCHAR(500),                            -- Cloudinary URL
  media_type VARCHAR(50),                            -- 'image', 'file', 'video'
  file_name VARCHAR(255),
  file_size INT,
  -- Message status
  delivery_status VARCHAR(50) NOT NULL DEFAULT 'sent'  -- sent, delivered, seen
    CHECK (delivery_status IN ('sent', 'delivered', 'seen', 'failed')),
  is_edited BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_delivery_status ON messages(delivery_status);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_is_deleted ON messages(is_deleted);

-- ============================================================================
-- 6. MESSAGE READS TABLE (Track who has seen each message)
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_message_reads_message_id ON message_reads(message_id);
CREATE INDEX idx_message_reads_user_id ON message_reads(user_id);
CREATE UNIQUE INDEX idx_message_reads_unique ON message_reads(message_id, user_id);

-- ============================================================================
-- 7. SYSTEM HEALTH LOG (Auto-diagnostics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  check_name VARCHAR(255) NOT NULL,                  -- 'ui_render', 'api_latency', 'db_connection', etc
  status VARCHAR(50) NOT NULL DEFAULT 'healthy'      -- healthy, warning, critical
    CHECK (status IN ('healthy', 'warning', 'critical')),
  message TEXT,
  metrics JSONB DEFAULT '{}',                        -- Performance metrics, error counts, etc
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_health_check_name ON system_health(check_name);
CREATE INDEX idx_system_health_status ON system_health(status);
CREATE INDEX idx_system_health_checked_at ON system_health(checked_at DESC);

-- ============================================================================
-- GRANT PERMISSIONS (ensure app user can access tables)
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON issues TO consty_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO consty_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO consty_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_members TO consty_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO consty_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON message_reads TO consty_user;
GRANT SELECT, INSERT, UPDATE ON system_health TO consty_user;
