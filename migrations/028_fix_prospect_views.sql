-- Fix Prospect Dashboard Views

DROP VIEW IF EXISTS prospect_agent_performance CASCADE;
DROP VIEW IF EXISTS prospect_pipeline_summary CASCADE;
DROP VIEW IF EXISTS prospect_activity_summary CASCADE;

-- Prospect Pipeline Summary
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

-- Agent Performance (with proper casting)
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
LEFT JOIN prospects p ON u.id = p.assigned_sales_agent_id::bigint AND p.status = 'active'
LEFT JOIN prospect_activities pa ON p.id = pa.prospect_id
WHERE u.role = 'staff' OR u.role = 'admin'
GROUP BY u.id, u.full_name
ORDER BY converted_count DESC;

-- Prospect Activity Summary
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
