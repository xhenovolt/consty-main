-- ============================================================================
-- PROSPECT MANAGEMENT SYSTEM - COMPREHENSIVE DATABASE SCHEMA
-- Implements founder-grade CRM with full prospect lifecycle tracking
-- ============================================================================

-- PHASE 1: CORE PROSPECT TABLES
-- ============================================================================

-- Prospect Sources (Static reference)
CREATE TABLE IF NOT EXISTS prospect_sources (
  id SERIAL PRIMARY KEY,
  source_name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert standard sources
INSERT INTO prospect_sources (source_name, description) VALUES
  ('Cold Call', 'Outbound prospecting call'),
  ('Referral', 'Referred by existing contact'),
  ('Event', 'Met at conference, networking event, or trade show'),
  ('Walk-in', 'Unsolicited visit or inquiry'),
  ('Website', 'Inbound inquiry from website'),
  ('Social Media', 'Discovered via LinkedIn, Twitter, or other social platform'),
  ('Email', 'Inbound email inquiry'),
  ('Partner', 'Referred by business partner'),
  ('Other', 'Other source')
ON CONFLICT DO NOTHING;

-- Prospect Industries (Static reference)
CREATE TABLE IF NOT EXISTS prospect_industries (
  id SERIAL PRIMARY KEY,
  industry_name VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert standard industries
INSERT INTO prospect_industries (industry_name, category) VALUES
  ('Education', 'Service'),
  ('Technology', 'Tech'),
  ('Healthcare', 'Service'),
  ('Finance', 'Service'),
  ('Manufacturing', 'Product'),
  ('Retail', 'Product'),
  ('Real Estate', 'Service'),
  ('Consulting', 'Service'),
  ('Hospitality', 'Service'),
  ('Government', 'Public'),
  ('Non-Profit', 'Public'),
  ('Other', 'Other')
ON CONFLICT DO NOTHING;

-- Prospect Pipeline Stages
CREATE TABLE IF NOT EXISTS prospect_stages (
  id SERIAL PRIMARY KEY,
  stage_name VARCHAR(50) UNIQUE NOT NULL,
  stage_order INT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert standard pipeline stages
INSERT INTO prospect_stages (stage_name, stage_order, description) VALUES
  ('Prospect', 1, 'Initial contact identified'),
  ('Contacted', 2, 'First contact made'),
  ('Interested', 3, 'Prospect shows interest'),
  ('Negotiating', 4, 'Active negotiation phase'),
  ('Converted', 5, 'Converted to customer'),
  ('Lost', 6, 'Lost to competitor or disqualified')
ON CONFLICT DO NOTHING;

-- Main Prospects Table
CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  prospect_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone_number VARCHAR(20),
  whatsapp_number VARCHAR(20),
  
  -- Organization
  company_name VARCHAR(255),
  industry_id INT REFERENCES prospect_industries(id) ON DELETE SET NULL,
  
  -- Location
  city VARCHAR(100),
  country VARCHAR(100),
  address TEXT,
  
  -- Prospect Info
  source_id INT NOT NULL REFERENCES prospect_sources(id),
  current_stage_id INT NOT NULL REFERENCES prospect_stages(id) DEFAULT 1,
  
  -- Assignment & Tracking (users.id is UUID)
  assigned_sales_agent_id UUID,
  created_by_id UUID NOT NULL,
  
  -- Activity Tracking
  first_contacted_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  next_followup_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'interested', 'disqualified')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_contact CHECK (email IS NOT NULL OR phone_number IS NOT NULL)
);

-- Prospect Tags/Labels
CREATE TABLE IF NOT EXISTS prospect_tags (
  id SERIAL PRIMARY KEY,
  tag_name VARCHAR(50) UNIQUE NOT NULL,
  color_code VARCHAR(7),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Prospect-Tag Junction
CREATE TABLE IF NOT EXISTS prospect_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  tag_id INT NOT NULL REFERENCES prospect_tags(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(prospect_id, tag_id)
);

-- Prospect Activities (Interaction History)
CREATE TABLE IF NOT EXISTS prospect_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  
  -- Activity Type
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    'call', 'email', 'meeting', 'message', 'note', 'stage_change', 
    'follow_up_set', 'deal_created', 'deal_converted'
  )),
  
  -- Content
  subject VARCHAR(255),
  description TEXT,
  outcome VARCHAR(255),
  notes TEXT,
  
  -- Products Discussed
  products_discussed TEXT[],
  
  -- Objections & Feedback
  objections TEXT,
  feedback TEXT,
  
  -- Activity Details
  activity_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  duration_minutes INT,
  
  -- Tracking (created_by_id is UUID)
  created_by_id UUID NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Prospect-Deal Link (eventual conversion)
CREATE TABLE IF NOT EXISTS prospect_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  deal_id UUID,
  
  conversion_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  conversion_status VARCHAR(50) DEFAULT 'converted' CHECK (conversion_status IN ('converted', 'in_progress', 'pending')),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(prospect_id)
);

-- PHASE 2: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_prospects_stage_id ON prospects(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_prospects_source_id ON prospects(source_id);
CREATE INDEX IF NOT EXISTS idx_prospects_assigned_agent ON prospects(assigned_sales_agent_id);
CREATE INDEX IF NOT EXISTS idx_prospects_created_by ON prospects(created_by_id);
CREATE INDEX IF NOT EXISTS idx_prospects_company ON prospects(company_name);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_next_followup ON prospects(next_followup_at);
CREATE INDEX IF NOT EXISTS idx_prospects_created_at ON prospects(created_at);
CREATE INDEX IF NOT EXISTS idx_prospects_last_activity ON prospects(last_activity_at);

CREATE INDEX IF NOT EXISTS idx_prospect_activities_prospect_id ON prospect_activities(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_activities_type ON prospect_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_prospect_activities_created_by ON prospect_activities(created_by_id);
CREATE INDEX IF NOT EXISTS idx_prospect_activities_date ON prospect_activities(activity_date);

CREATE INDEX IF NOT EXISTS idx_prospect_tags_prospect_id ON prospect_tag_assignments(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_tags_tag_id ON prospect_tag_assignments(tag_id);

CREATE INDEX IF NOT EXISTS idx_prospect_conversions_prospect ON prospect_conversions(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_conversions_deal ON prospect_conversions(deal_id);

-- PHASE 3: AUDIT & HISTORY
-- ============================================================================

-- Prospect Stage History (for tracking changes)
CREATE TABLE IF NOT EXISTS prospect_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  previous_stage_id INT REFERENCES prospect_stages(id) ON DELETE SET NULL,
  new_stage_id INT NOT NULL REFERENCES prospect_stages(id),
  
  reason_for_change TEXT,
  changed_by_id UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prospect_stage_history_prospect ON prospect_stage_history(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_stage_history_changed_at ON prospect_stage_history(changed_at);

-- PHASE 4: MATERIALIZED VIEWS FOR DASHBOARDS
-- ============================================================================

-- Prospect Pipeline Summary
CREATE OR REPLACE VIEW prospect_pipeline_summary AS
SELECT 
  ps.id as stage_id,
  ps.stage_name,
  ps.stage_order,
  COUNT(p.id) as prospect_count,
  COUNT(DISTINCT p.assigned_sales_agent_id) as agent_count,
  ROUND(100.0 * COUNT(p.id) / NULLIF((SELECT COUNT(*) FROM prospects WHERE status = 'active'), 0), 2) as percentage_of_total,
  MAX(p.last_activity_at) as last_activity,
  COUNT(CASE WHEN p.next_followup_at <= CURRENT_TIMESTAMP THEN 1 END) as overdue_followups
FROM prospect_stages ps
LEFT JOIN prospects p ON ps.id = p.current_stage_id AND p.status = 'active'
GROUP BY ps.id, ps.stage_name, ps.stage_order
ORDER BY ps.stage_order;

-- Agent Performance
CREATE OR REPLACE VIEW prospect_agent_performance AS
SELECT 
  u.id as agent_id,
  u.full_name as agent_name,
  COUNT(DISTINCT p.id) as total_prospects,
  COUNT(DISTINCT CASE WHEN p.current_stage_id = 5 THEN p.id END) as converted_count,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN p.current_stage_id = 5 THEN p.id END) / NULLIF(COUNT(DISTINCT p.id), 0), 2) as conversion_rate,
  COUNT(DISTINCT pa.id) as total_activities,
  MAX(pa.activity_date) as last_activity_date
FROM users u
LEFT JOIN prospects p ON u.id::bigint = p.assigned_sales_agent_id AND p.status = 'active'
LEFT JOIN prospect_activities pa ON p.id = pa.prospect_id
WHERE u.role = 'staff'
GROUP BY u.id, u.full_name
ORDER BY converted_count DESC;

-- Prospect Activity Summary
CREATE OR REPLACE VIEW prospect_activity_summary AS
SELECT 
  p.id as prospect_id,
  p.prospect_name,
  p.company_name,
  COUNT(pa.id) as activity_count,
  MAX(pa.activity_date) as last_activity_date,
  STRING_AGG(DISTINCT pa.activity_type, ', ') as activity_types
FROM prospects p
LEFT JOIN prospect_activities pa ON p.id = pa.prospect_id
WHERE p.status = 'active'
GROUP BY p.id, p.prospect_name, p.company_name;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
