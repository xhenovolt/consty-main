/**
 * Migration: Create external_connections table
 * 
 * Stores encrypted API credentials for external systems like DRAIS
 * Supports multiple connections with switchable active connection
 * 
 * SECURITY:
 * - api_key and api_secret stored ENCRYPTED
 * - Decryption only happens server-side during proxy calls
 * - Never exposed to frontend
 */

CREATE TABLE IF NOT EXISTS external_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Connection metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  system_type VARCHAR(50) NOT NULL DEFAULT 'drais', -- drais, other systems
  
  -- Connection details
  base_url VARCHAR(500) NOT NULL,
  
  -- Encrypted credentials
  api_key_encrypted VARCHAR(1000) NOT NULL,
  api_secret_encrypted VARCHAR(1000) NOT NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  last_tested_at TIMESTAMP,
  
  -- Audit
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(name)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_external_connections_is_active ON external_connections(is_active);
CREATE INDEX IF NOT EXISTS idx_external_connections_system_type ON external_connections(system_type);
CREATE INDEX IF NOT EXISTS idx_external_connections_created_at ON external_connections(created_at DESC);

-- Table to audit connection usage and errors
CREATE TABLE IF NOT EXISTS external_connection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES external_connections(id) ON DELETE CASCADE,
  
  action VARCHAR(100),          -- 'test', 'get_schools', 'suspend_school', etc
  method VARCHAR(10),           -- GET, POST, PATCH, DELETE
  endpoint VARCHAR(500),
  
  status_code INT,
  request_count INT DEFAULT 1,
  error_message TEXT,
  
  executed_by UUID,
  executed_at TIMESTAMP DEFAULT NOW(),
  
  response_time_ms INT
);

-- Indexes for connection logs
CREATE INDEX IF NOT EXISTS idx_connection_logs_connection_id ON external_connection_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_connection_logs_executed_at ON external_connection_logs(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_connection_logs_status_code ON external_connection_logs(status_code);

-- Grant permissions
GRANT SELECT ON external_connections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON external_connections TO authenticated;
GRANT SELECT ON external_connection_logs TO authenticated;
GRANT INSERT ON external_connection_logs TO authenticated;
