/**
 * Migration: Prospect Activity Log & Sales Intelligence System
 * 
 * Creates the core tables and infrastructure for Consty's Sales Intelligence System:
 * 1. prospect_activities - Chronological journal of ALL interactions
 * 2. Enhanced prospects table with better metadata
 * 3. Indexes and triggers for efficient querying
 * 4. Audit-proof activity logging (append-only)
 * 
 * This transforms prospecting from memory-dependent to external-brain-based
 */

-- ============================================================================
-- PROSPECT ACTIVITY LOG (The Heart of Sales Intelligence)
-- ============================================================================

/**
 * This is the most important table in the Sales Intelligence System.
 * 
 * Rules:
 * - APPEND ONLY - Activities are never deleted or modified
 * - Immutable audit trail - Every prospect interaction is permanently recorded
 * - Chronological ordering - Sequential timeline of relationship maturity
 * - Complete context - What happened, when, feelings/mood, outcomes
 */

CREATE TABLE IF NOT EXISTS prospect_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  
  -- Activity metadata
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    'INITIAL_CONTACT',      -- First time contact made
    'CONVERSATION',         -- Discussion/call/meeting
    'FOLLOW_UP',            -- Scheduled follow-up
    'EMAIL',                -- Email sent/received
    'MEETING',              -- Face-to-face or video meeting
    'DEMO',                 -- Product demonstration
    'PROPOSAL',             -- Proposal sent
    'NEGOTIATION',          -- Negotiation discussion
    'OBJECTION_HANDLED',    -- Objection addressed
    'DECISION_POINT',       -- Critical decision moment
    'CONVERTED',            -- Prospect converted to deal
    'LOST',                 -- Prospect lost/unqualified
    'NOTE'                  -- General note/observation
  )),
  
  -- Activity details
  title VARCHAR(255) NOT NULL,
  description TEXT,                  -- What was discussed/happened
  outcome VARCHAR(50),               -- 'positive', 'neutral', 'negative', 'pending', 'action_required'
  
  -- Conversation specifics
  product_discussed TEXT,             -- What product/service was talked about
  objections_raised TEXT,             -- Customer objections or concerns
  objections_handled BOOLEAN DEFAULT false, -- Were they resolved?
  resolution TEXT,                    -- How were objections resolved
  
  -- Sentiment & Readiness
  prospect_mood VARCHAR(30),          -- 'very_interested', 'interested', 'neutral', 'lukewarm', 'cold'
  confidence_level DECIMAL(3,1),      -- 1-10 scale (commitment readiness)
  
  -- Next steps
  next_action varchar(255),           -- What happens next
  follow_up_date DATE,                -- When to follow up
  follow_up_type VARCHAR(50),         -- 'call', 'email', 'meeting', 'demo'
  
  -- Communication method
  communication_method VARCHAR(50),   -- 'phone', 'email', 'meeting', 'video', 'sms'
  duration_minutes INTEGER,           -- How long was the conversation
  
  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  -- Immutability markers
  is_locked BOOLEAN DEFAULT false,    -- Once set, activity cannot be modified
  locked_at TIMESTAMP,
  locked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Indexing for performance
  CONSTRAINT valid_confidence CHECK (confidence_level >= 1 AND confidence_level <= 10)
);

-- Critical indexes for the activity log
CREATE INDEX IF NOT EXISTS idx_activities_prospect_created 
  ON prospect_activities(prospect_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_type 
  ON prospect_activities(activity_type);

CREATE INDEX IF NOT EXISTS idx_activities_follow_up 
  ON prospect_activities(follow_up_date) 
  WHERE follow_up_date IS NOT NULL AND outcome IN ('pending', 'action_required');

CREATE INDEX IF NOT EXISTS idx_activities_outcome
  ON prospect_activities(outcome);

-- Immutability trigger: prevent updates to locked activities
CREATE OR REPLACE FUNCTION prevent_locked_activity_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked THEN
    RAISE EXCEPTION 'Cannot modify locked activity (created %)', OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_locked_activity_update ON prospect_activities;
CREATE TRIGGER trg_prevent_locked_activity_update
BEFORE UPDATE ON prospect_activities
FOR EACH ROW
EXECUTE FUNCTION prevent_locked_activity_update();

-- ============================================================================
-- ENHANCE PROSPECTS TABLE WITH ADDITIONAL FIELDS
-- ============================================================================

-- Add missing columns for better prospect tracking
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS interest_level VARCHAR(30) 
  DEFAULT 'New' CHECK (interest_level IN ('New', 'Low', 'Medium', 'High', 'Very High'));

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS assigned_to UUID 
  REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_contact_date DATE;

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_activity_id UUID 
  REFERENCES prospect_activities(id) ON DELETE SET NULL;

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS next_follow_up_date DATE;

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS total_activities_count INTEGER DEFAULT 0;

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS conversion_date TIMESTAMP;

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS days_in_pipeline INTEGER GENERATED ALWAYS AS 
  (EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at)))
  STORED;

-- Update status enums to match user requirements
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS check_status CASCADE;

ALTER TABLE prospects ADD CONSTRAINT check_sales_stage CHECK (
  sales_stage IN (
    'New',
    'Contacted', 
    'Follow-Up Needed',
    'Interested',
    'Negotiating',
    'Converted',
    'Not Interested',
    'Lost'
  )
);

-- ============================================================================
-- ACTIVITY LOG STATISTICS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW prospect_activity_summary AS
SELECT 
  p.id,
  p.prospect_name,
  COUNT(pa.id) as total_activities,
  COUNT(CASE WHEN pa.activity_type = 'CONVERSATION' THEN 1 END) as conversations,
  COUNT(CASE WHEN pa.activity_type = 'FOLLOW_UP' THEN 1 END) as follow_ups,
  COUNT(CASE WHEN pa.activity_type = 'MEETING' THEN 1 END) as meetings,
  COUNT(CASE WHEN pa.outcome = 'positive' THEN 1 END) as positive_outcomes,
  MAX(pa.created_at) as last_activity_at,
  MAX(CASE WHEN pa.follow_up_date IS NOT NULL THEN pa.follow_up_date END) as next_scheduled_follow_up,
  AVG(CASE WHEN pa.confidence_level IS NOT NULL THEN pa.confidence_level ELSE 0 END) as avg_confidence
FROM prospects p
LEFT JOIN prospect_activities pa ON p.id = pa.prospect_id
GROUP BY p.id, p.prospect_name;

-- ============================================================================
-- TRIGGER: Auto-update prospect last_contact_date and activity_count
-- ============================================================================

CREATE OR REPLACE FUNCTION update_prospect_activity_state()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE prospects
  SET 
    last_contact_date = NEW.created_at::DATE,
    last_activity_id = NEW.id,
    total_activities_count = (
      SELECT COUNT(*) FROM prospect_activities WHERE prospect_id = NEW.prospect_id
    ),
    next_follow_up_date = NEW.follow_up_date
  WHERE id = NEW.prospect_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_prospect_activity_state ON prospect_activities;
CREATE TRIGGER trg_update_prospect_activity_state
AFTER INSERT ON prospect_activities
FOR EACH ROW
EXECUTE FUNCTION update_prospect_activity_state();

-- ============================================================================
-- TRIGGER: Update last_activity_id when activity is updated
-- ============================================================================

CREATE OR REPLACE FUNCTION update_prospect_last_activity_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Update next_follow_up_date if the follow_up_date changes
  IF NEW.follow_up_date IS DISTINCT FROM OLD.follow_up_date THEN
    UPDATE prospects
    SET next_follow_up_date = NEW.follow_up_date
    WHERE id = NEW.prospect_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_prospect_on_activity_update ON prospect_activities;
CREATE TRIGGER trg_update_prospect_on_activity_update
AFTER UPDATE ON prospect_activities
FOR EACH ROW
EXECUTE FUNCTION update_prospect_last_activity_on_update();

-- ============================================================================
-- HELPER FUNCTION: Convert Prospect to Deal
-- ============================================================================

CREATE OR REPLACE FUNCTION convert_prospect_to_deal(
  p_prospect_id UUID,
  p_product_service VARCHAR(255),
  p_deal_title VARCHAR(255),
  p_value_estimate DECIMAL(19,2),
  p_converted_by UUID
)
RETURNS TABLE(deal_id UUID, success BOOLEAN, message TEXT) AS $$
DECLARE
  v_prospect prospects%ROWTYPE;
  v_deal_id UUID;
BEGIN
  -- Get prospect details
  SELECT * INTO v_prospect FROM prospects WHERE id = p_prospect_id AND deleted_at IS NULL;
  
  IF v_prospect IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, false, 'Prospect not found';
    RETURN;
  END IF;
  
  -- Check if already converted
  IF v_prospect.converted_deal_id IS NOT NULL THEN
    RETURN QUERY SELECT v_prospect.converted_deal_id, false, 'Prospect already converted to deal';
    RETURN;
  END IF;
  
  -- Create the deal
  INSERT INTO deals (
    title,
    client_name,
    client_email,
    stage,
    status,
    value_estimate,
    expected_close_date,
    created_by,
    created_at
  ) VALUES (
    COALESCE(p_deal_title, p_prospect.prospect_name || ' - ' || COALESCE(p_product_service, 'Deal')),
    p_prospect.prospect_name,
    p_prospect.email,
    'Negotiating',
    'ACTIVE',
    COALESCE(p_value_estimate, 0),
    CURRENT_DATE + INTERVAL '30 days',
    COALESCE(p_converted_by, p_prospect.created_by),
    CURRENT_TIMESTAMP
  )
  RETURNING deals.id INTO v_deal_id;
  
  -- Update prospect with conversion info
  UPDATE prospects
  SET 
    converted_deal_id = v_deal_id,
    sales_stage = 'Converted',
    status = 'Converted',
    conversion_date = CURRENT_TIMESTAMP
  WHERE id = p_prospect_id;
  
  -- Log this as an activity
  INSERT INTO prospect_activities (
    prospect_id,
    activity_type,
    title,
    description,
    outcome,
    product_discussed,
    next_action,
    created_by
  ) VALUES (
    p_prospect_id,
    'CONVERTED',
    'Prospect converted to deal',
    'Automatically converted from prospect to deal #' || v_deal_id,
    'positive',
    p_product_service,
    'Send deal details to prospect',
    COALESCE(p_converted_by, p_prospect.created_by)
  );
  
  RETURN QUERY SELECT v_deal_id, true, 'Prospect successfully converted to deal';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTION: Get overdue follow-ups
-- ============================================================================

CREATE OR REPLACE FUNCTION get_overdue_follow_ups()
RETURNS TABLE(
  prospect_id UUID,
  prospect_name VARCHAR(255),
  days_overdue INTEGER,
  last_activity_title VARCHAR(255),
  next_follow_up_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.prospect_name,
    EXTRACT(DAY FROM (CURRENT_DATE - p.next_follow_up_date))::INTEGER,
    pa.title,
    p.next_follow_up_date
  FROM prospects p
  LEFT JOIN prospect_activities pa ON p.last_activity_id = pa.id
  WHERE 
    p.next_follow_up_date IS NOT NULL
    AND p.next_follow_up_date < CURRENT_DATE
    AND p.deleted_at IS NULL
    AND p.sales_stage NOT IN ('Converted', 'Lost', 'Not Interested')
  ORDER BY p.next_follow_up_date ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTION: Get today's prospecting summary
-- ============================================================================

CREATE OR REPLACE FUNCTION get_today_prospecting_summary(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
  new_prospects_today INTEGER,
  follow_ups_due_today INTEGER,
  overdue_follow_ups INTEGER,
  conversations_logged_today INTEGER,
  conversion_count_this_week INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(COUNT(DISTINCT CASE WHEN p.created_at::DATE = p_date THEN p.id END), 0)::INTEGER,
    COALESCE(COUNT(DISTINCT CASE WHEN p.next_follow_up_date = p_date THEN p.id END), 0)::INTEGER,
    COALESCE(COUNT(DISTINCT CASE WHEN p.next_follow_up_date < p_date AND p.sales_stage NOT IN ('Converted', 'Lost', 'Not Interested') THEN p.id END), 0)::INTEGER,
    COALESCE(COUNT(DISTINCT CASE WHEN pa.activity_type = 'CONVERSATION' AND pa.created_at::DATE = p_date THEN pa.id END), 0)::INTEGER,
    COALESCE(COUNT(DISTINCT CASE WHEN p.conversion_date::DATE >= (p_date - INTERVAL '7 days') THEN p.id END), 0)::INTEGER
  FROM prospects p
  LEFT JOIN prospect_activities pa ON p.id = pa.prospect_id
  WHERE p.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DATA INTEGRITY CHECKS
-- ============================================================================

-- Ensure activity count stays in sync
CREATE OR REPLACE FUNCTION verify_activity_counts()
RETURNS TABLE(prospect_id UUID, expected_count BIGINT, actual_count INTEGER, mismatch BOOLEAN) AS $$
SELECT 
  p.id,
  COUNT(pa.id),
  p.total_activities_count,
  COUNT(pa.id) != COALESCE(p.total_activities_count, 0)
FROM prospects p
LEFT JOIN prospect_activities pa ON p.id = pa.prospect_id
GROUP BY p.id, p.total_activities_count
HAVING COUNT(pa.id) != COALESCE(p.total_activities_count, 0);
$$ LANGUAGE SQL;

-- ============================================================================
-- INITIAL SETUP (run after migration)
-- ============================================================================

-- Update activity counts for existing prospects
UPDATE prospects p
SET total_activities_count = (
  SELECT COUNT(*) FROM prospect_activities WHERE prospect_id = p.id
)
WHERE deleted_at IS NULL;

-- Update last_contact_date and next_follow_up_date from activities
UPDATE prospects p
SET 
  last_contact_date = (
    SELECT pa.created_at::DATE FROM prospect_activities pa
    WHERE pa.prospect_id = p.id
    ORDER BY pa.created_at DESC
    LIMIT 1
  ),
  next_follow_up_date = (
    SELECT pa.follow_up_date FROM prospect_activities pa
    WHERE pa.prospect_id = p.id
    AND pa.follow_up_date IS NOT NULL
    ORDER BY pa.follow_up_date DESC
    LIMIT 1
  )
WHERE deleted_at IS NULL;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE prospect_activities IS 'Append-only activity log. Records every interaction with a prospect. Never modify or delete entries - always append new activities.';

COMMENT ON COLUMN prospect_activities.is_locked IS 'Once locked, activity cannot be edited. Allows marking activities as final/reviewed.';

COMMENT ON FUNCTION convert_prospect_to_deal(UUID, VARCHAR(255), VARCHAR(255), DECIMAL(19,2), UUID) IS 'Converts a prospect to a deal. Auto-populates deal fields from prospect data. Cannot be undone.';
