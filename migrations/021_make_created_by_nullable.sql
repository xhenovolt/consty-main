-- Migration: Make created_by nullable in all remaining tables
-- Allows flexibility in asset, liability, and snapshot creation

-- Fix liabilities table
ALTER TABLE liabilities
ALTER COLUMN created_by DROP NOT NULL;

-- Fix assets table
ALTER TABLE assets
ALTER COLUMN created_by DROP NOT NULL;

-- Fix snapshots table
ALTER TABLE snapshots
ALTER COLUMN created_by DROP NOT NULL;
