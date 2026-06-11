-- Fix prospects tables to use correct UUID types for users

-- Drop dependent tables first
DROP TABLE IF EXISTS prospect_conversions CASCADE;
DROP TABLE IF EXISTS prospect_stage_history CASCADE;
DROP TABLE IF EXISTS prospect_activities CASCADE;
DROP TABLE IF EXISTS prospect_tag_assignments CASCADE;
DROP TABLE IF EXISTS prospects CASCADE;

-- Recreate prospects table with UUID for user IDs
CREATE TABLE prospects (
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
  
  -- Assignment & Tracking
  assigned_sales_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_id UUID NOT NULL REFERENCES users(id),
  
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

-- Prospect-Tag Junction
CREATE TABLE prospect_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  tag_id INT NOT NULL REFERENCES prospect_tags(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(prospect_id, tag_id)
);

-- Prospect Activities (Interaction History)
CREATE TABLE prospect_activities (
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
  
  -- Tracking
  created_by_id UUID NOT NULL REFERENCES users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Prospect-Deal Link (eventual conversion)
CREATE TABLE prospect_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  deal_id UUID,
  
  conversion_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  conversion_status VARCHAR(50) DEFAULT 'converted' CHECK (conversion_status IN ('converted', 'in_progress', 'pending')),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(prospect_id)
);

-- Prospect Stage History (for tracking changes)
CREATE TABLE prospect_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  previous_stage_id INT REFERENCES prospect_stages(id) ON DELETE SET NULL,
  new_stage_id INT NOT NULL REFERENCES prospect_stages(id),
  
  reason_for_change TEXT,
  changed_by_id UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes
CREATE INDEX idx_prospects_stage_id ON prospects(current_stage_id);
CREATE INDEX idx_prospects_source_id ON prospects(source_id);
CREATE INDEX idx_prospects_assigned_agent ON prospects(assigned_sales_agent_id);
CREATE INDEX idx_prospects_created_by ON prospects(created_by_id);
CREATE INDEX idx_prospects_company ON prospects(company_name);
CREATE INDEX idx_prospects_status ON prospects(status);
CREATE INDEX idx_prospects_next_followup ON prospects(next_followup_at);
CREATE INDEX idx_prospects_created_at ON prospects(created_at);
CREATE INDEX idx_prospects_last_activity ON prospects(last_activity_at);

CREATE INDEX idx_prospect_activities_prospect_id ON prospect_activities(prospect_id);
CREATE INDEX idx_prospect_activities_type ON prospect_activities(activity_type);
CREATE INDEX idx_prospect_activities_created_by ON prospect_activities(created_by_id);
CREATE INDEX idx_prospect_activities_date ON prospect_activities(activity_date);

CREATE INDEX idx_prospect_tags_prospect_id ON prospect_tag_assignments(prospect_id);
CREATE INDEX idx_prospect_tags_tag_id ON prospect_tag_assignments(tag_id);

CREATE INDEX idx_prospect_conversions_prospect ON prospect_conversions(prospect_id);
CREATE INDEX idx_prospect_conversions_deal ON prospect_conversions(deal_id);

CREATE INDEX idx_prospect_stage_history_prospect ON prospect_stage_history(prospect_id);
CREATE INDEX idx_prospect_stage_history_changed_at ON prospect_stage_history(changed_at);

-- Recreate Views with correct UUID types
DROP VIEW IF EXISTS prospect_pipeline_summary CASCADE;
DROP VIEW IF EXISTS prospect_agent_performance CASCADE;
DROP VIEW IF EXISTS prospect_activity_summary CASCADE;

CREATE VIEW prospect_pipeline_summary AS
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

CREATE VIEW prospect_agent_performance AS
SELECT 
  u.id as agent_id,
  u.full_name as agent_name,
  COUNT(DISTINCT p.id) as total_prospects,
  COUNT(DISTINCT CASE WHEN p.current_stage_id = 5 THEN p.id END) as converted_count,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN p.current_stage_id = 5 THEN p.id END) / NULLIF(COUNT(DISTINCT p.id), 0), 2) as conversion_rate,
  COUNT(DISTINCT pa.id) as total_activities,
  MAX(pa.activity_date) as last_activity_date
FROM users u
LEFT JOIN prospects p ON u.id = p.assigned_sales_agent_id AND p.status = 'active'
LEFT JOIN prospect_activities pa ON p.id = pa.prospect_id
WHERE u.role = 'staff' OR u.role = 'admin'
GROUP BY u.id, u.full_name
ORDER BY converted_count DESC;

CREATE VIEW prospect_activity_summary AS
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
