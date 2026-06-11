-- Migration 952: Secret Management System
-- Adds tables for secure secret viewing and key rotation tracking

-- Table: secret_view_tokens
-- Stores temporary tokens for viewing secrets after password verification
CREATE TABLE IF NOT EXISTS secret_view_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_secret_view_tokens_user_id ON secret_view_tokens(user_id);
CREATE INDEX idx_secret_view_tokens_token ON secret_view_tokens(token);
CREATE INDEX idx_secret_view_tokens_expires_at ON secret_view_tokens(expires_at);

-- Add columns to external_connections table for rotation tracking
ALTER TABLE external_connections
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_rotated_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS rotation_enabled BOOLEAN DEFAULT true;

-- Extend audit_logs table to support new action types
-- Ensure the table exists and has required columns
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  status VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
