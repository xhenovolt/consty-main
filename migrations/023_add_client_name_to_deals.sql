-- Migration: Add client_name column to deals table
-- Adds the client_name field to track which client a deal is with

ALTER TABLE deals
ADD COLUMN IF NOT EXISTS client_name TEXT;

-- Create index for filtering by client
CREATE INDEX IF NOT EXISTS idx_deals_client_name ON deals(client_name) WHERE deleted_at IS NULL;
