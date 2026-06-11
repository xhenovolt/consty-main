-- Migration 031: Prospect-to-Client Unification
-- Links prospects to clients, enables prospect conversion workflow
-- Creates ProspectActivity table for follow-up tracking (daily sales notebook)

-- ============================================================================
-- 1) Link prospects to clients (FK relationship)
-- ============================================================================

ALTER TABLE prospects
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_prospects_client_id ON prospects(client_id);

-- ============================================================================
-- 2) Prospect Activity Table (Daily Sales Notebook)
-- ============================================================================
-- Tracks every follow-up, outcome, note, and next action for each prospect

CREATE TABLE IF NOT EXISTS prospect_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'note', 'outcome')),
  description TEXT NOT NULL,
  outcome VARCHAR(100), -- 'interested', 'not_interested', 'no_answer', 'rescheduled', 'converted'
  next_followup_date DATE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prospect_activities_prospect_id ON prospect_activities(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_activities_next_followup ON prospect_activities(next_followup_date);
CREATE INDEX IF NOT EXISTS idx_prospect_activities_created_at ON prospect_activities(created_at DESC);

-- Trigger to update prospect updated_at when activity is logged
CREATE OR REPLACE FUNCTION update_prospect_activity_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE prospects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.prospect_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prospect_activities_update ON prospect_activities;
CREATE TRIGGER trg_prospect_activities_update
AFTER INSERT ON prospect_activities
FOR EACH ROW
EXECUTE FUNCTION update_prospect_activity_timestamp();

-- ============================================================================
-- 3) View: Prospects Needing Follow-up (Daily Agenda)
-- ============================================================================

CREATE OR REPLACE VIEW prospects_needing_followup AS
SELECT
  p.id,
  p.prospect_name,
  p.email,
  p.phone,
  p.follow_up_date,
  p.sales_stage,
  COALESCE(MAX(pa.created_at), p.created_at) as last_activity_at,
  COALESCE(MAX(pa.description), '') as last_activity_note
FROM prospects p
LEFT JOIN prospect_activities pa ON p.id = pa.prospect_id
WHERE p.status = 'Active' 
  AND p.client_id IS NULL
  AND (p.follow_up_date IS NULL OR p.follow_up_date <= CURRENT_DATE)
GROUP BY p.id, p.prospect_name, p.email, p.phone, p.follow_up_date, p.sales_stage, p.created_at
ORDER BY p.follow_up_date ASC NULLS LAST, p.created_at ASC;

-- ============================================================================
-- 4) View: Prospects Ready to Convert
-- ============================================================================

CREATE OR REPLACE VIEW prospects_ready_to_convert AS
SELECT
  p.id,
  p.prospect_name,
  p.email,
  p.phone,
  p.business_name,
  p.sales_stage,
  COUNT(pa.id) as total_activities,
  MAX(pa.created_at) as last_contact_at
FROM prospects p
LEFT JOIN prospect_activities pa ON p.id = pa.prospect_id
WHERE p.status = 'Active'
  AND p.client_id IS NULL
  AND p.sales_stage IN ('Negotiating', 'Interested')
GROUP BY p.id, p.prospect_name, p.email, p.phone, p.business_name, p.sales_stage
ORDER BY p.sales_stage DESC, MAX(pa.created_at) DESC NULLS LAST;

-- ============================================================================
-- 5) View: Active Prospects with Latest Activity
-- ============================================================================

CREATE OR REPLACE VIEW prospects_with_activity AS
SELECT
  p.id,
  p.prospect_name,
  p.email,
  p.phone,
  p.business_name,
  p.sales_stage,
  p.follow_up_date,
  p.client_id,
  c.name as client_name,
  COUNT(pa.id) as total_activities,
  MAX(pa.created_at) as last_activity_at,
  COALESCE(MAX(pa.outcome), '') as last_outcome
FROM prospects p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN prospect_activities pa ON p.id = pa.prospect_id
WHERE p.status = 'Active'
GROUP BY
  p.id, p.prospect_name, p.email, p.phone, p.business_name, p.sales_stage,
  p.follow_up_date, p.client_id, c.name
ORDER BY p.created_at DESC;

-- ============================================================================
-- 6) Success
-- ============================================================================

SELECT '✓ Migration 031: Prospect-to-Client unification complete' as status;
SELECT '✓ Added client_id FK to prospects' as status;
SELECT '✓ Created prospect_activities table for follow-up tracking' as status;
SELECT '✓ Created 3 views for daily sales workflow' as status;
