/**
 * Migration 102: Add prospect_id to deals and fix schema mismatches
 */

-- Add prospect_id to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_prospect ON deals(prospect_id);

-- System_id in deals should reference intellectual_property
-- Note: the intellectual_property table uses UUID as primary key
