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

CREATE INDEX IF NOT EXISTS idx_secret_view_tokens_user_id ON secret_view_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_secret_view_tokens_token ON secret_view_tokens(token);
CREATE INDEX IF NOT EXISTS idx_secret_view_tokens_expires_at ON secret_view_tokens(expires_at);

-- Add columns to external_connections table for rotation tracking
ALTER TABLE external_connections
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_rotated_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS rotation_enabled BOOLEAN DEFAULT true;

-- Extend audit_logs table to support additional fields for secret management
-- Add user_agent column if not exists (for security logging)
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Create indexes for audit_logs if they don't exist
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
