/**
 * Migration: Pipeline Analytics & Reporting Infrastructure
 * 
 * Creates aggregated views and tables for pipeline reporting and analytics
 * Supports real-time dashboard with revenue tracking and deal analysis
 */

-- ============================================================================
-- PIPELINE METRICS CACHE (Optional: for performance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pipeline_metrics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  metric_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly'
  
  -- Aggregated metrics
  total_pipeline_value DECIMAL(19,2) DEFAULT 0,
  won_deals_count INTEGER DEFAULT 0,
  won_deals_value DECIMAL(19,2) DEFAULT 0,
  pending_deals_count INTEGER DEFAULT 0,
  pending_deals_value DECIMAL(19,2) DEFAULT 0,
  lost_deals_count INTEGER DEFAULT 0,
  lost_deals_value DECIMAL(19,2) DEFAULT 0,
  
  -- By stage breakdown
  stage_lead_count INTEGER DEFAULT 0,
  stage_lead_value DECIMAL(19,2) DEFAULT 0,
  stage_contacted_count INTEGER DEFAULT 0,
  stage_contacted_value DECIMAL(19,2) DEFAULT 0,
  stage_proposal_count INTEGER DEFAULT 0,
  stage_proposal_value DECIMAL(19,2) DEFAULT 0,
  stage_negotiation_count INTEGER DEFAULT 0,
  stage_negotiation_value DECIMAL(19,2) DEFAULT 0,
  
  -- By owner breakdown
  owner_id UUID,
  owner_pipeline_value DECIMAL(19,2) DEFAULT 0,
  owner_won_value DECIMAL(19,2) DEFAULT 0,
  
  -- Average metrics
  avg_deal_value DECIMAL(19,2) DEFAULT 0,
  weighted_pipeline_value DECIMAL(19,2) DEFAULT 0, -- Considers probability
  
  -- Revenue from sales
  revenue_from_sales DECIMAL(19,2) DEFAULT 0,
  revenue_from_pending_sales DECIMAL(19,2) DEFAULT 0,
  
  -- Timestamps
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(metric_date, metric_type, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_date 
ON pipeline_metrics_cache(metric_date, metric_type);

CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_owner 
ON pipeline_metrics_cache(owner_id, metric_date);

-- ============================================================================
-- DEAL STAGE TRANSITIONS LOG (for funnel analysis)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_stage_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  from_stage VARCHAR(50),
  to_stage VARCHAR(50) NOT NULL,
  transition_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  moved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_stage_transitions_deal 
ON deal_stage_transitions(deal_id);

CREATE INDEX IF NOT EXISTS idx_stage_transitions_date 
ON deal_stage_transitions(transition_date);

CREATE INDEX IF NOT EXISTS idx_stage_transitions_from_to 
ON deal_stage_transitions(from_stage, to_stage);

-- ============================================================================
-- TRIGGER: Log deal stage transitions
-- ============================================================================

CREATE OR REPLACE FUNCTION log_deal_stage_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage != OLD.stage THEN
    INSERT INTO deal_stage_transitions (deal_id, from_stage, to_stage, moved_by)
    VALUES (NEW.id, OLD.stage, NEW.stage, NEW.created_by);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deal_stage_transition_log ON deals;

CREATE TRIGGER deal_stage_transition_log
AFTER UPDATE ON deals
FOR EACH ROW
EXECUTE FUNCTION log_deal_stage_transition();

-- ============================================================================
-- MATERIALIZED VIEW: Pipeline Overview by Stage
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS pipeline_by_stage AS
SELECT 
  deals.stage,
  COUNT(*) as deal_count,
  SUM(deals.value_estimate) as stage_total_value,
  AVG(deals.value_estimate) as avg_deal_value,
  SUM(deals.value_estimate * deals.probability / 100) as weighted_value,
  COUNT(CASE WHEN sales.id IS NOT NULL THEN 1 END) as deals_with_sales,
  SUM(CASE WHEN sales.status = 'Paid' THEN sales.total_amount ELSE 0 END) as collected_revenue
FROM deals
LEFT JOIN sales ON deals.id = sales.deal_id
WHERE deals.deleted_at IS NULL AND deals.status = 'ACTIVE'
GROUP BY deals.stage
ORDER BY 
  CASE 
    WHEN deals.stage = 'Lead' THEN 1
    WHEN deals.stage = 'Contacted' THEN 2
    WHEN deals.stage = 'Proposal Sent' THEN 3
    WHEN deals.stage = 'Negotiation' THEN 4
    WHEN deals.stage = 'Won' THEN 5
    WHEN deals.stage = 'Lost' THEN 6
    ELSE 7
  END;

-- ============================================================================
-- MATERIALIZED VIEW: Pipeline by Owner
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS pipeline_by_owner AS
SELECT 
  deals.created_by as owner_id,
  users.name as owner_name,
  COUNT(*) as total_deals,
  SUM(CASE WHEN deals.stage != 'Won' AND deals.stage != 'Lost' THEN 1 ELSE 0 END) as active_deals,
  COUNT(CASE WHEN deals.stage = 'Won' THEN 1 END) as won_deals,
  COUNT(CASE WHEN deals.stage = 'Lost' THEN 1 END) as lost_deals,
  SUM(deals.value_estimate) as total_value,
  SUM(CASE WHEN deals.stage = 'Won' THEN deals.value_estimate ELSE 0 END) as won_value,
  SUM(deals.value_estimate * deals.probability / 100) as weighted_value,
  AVG(deals.value_estimate) as avg_deal_value,
  SUM(CASE WHEN sales.status = 'Paid' THEN sales.total_amount ELSE 0 END) as collected_revenue
FROM deals
LEFT JOIN users ON deals.created_by = users.id
LEFT JOIN sales ON deals.id = sales.deal_id
WHERE deals.deleted_at IS NULL AND deals.status = 'ACTIVE'
GROUP BY deals.created_by, users.name
ORDER BY won_value DESC NULLS LAST;

-- ============================================================================
-- MATERIALIZED VIEW: Won Deal to Sales Conversion
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS deal_sales_conversion AS
SELECT 
  deals.id as deal_id,
  deals.title as deal_title,
  deals.client_name,
  deals.value_estimate as deal_value,
  deals.expected_close_date,
  deals.created_by,
  deals.created_at as deal_created_at,
  sales.id as sale_id,
  sales.customer_name as sale_customer,
  sales.total_amount as sale_amount,
  sales.status as sale_status,
  sales.sale_date,
  CASE WHEN sales.id IS NOT NULL THEN true ELSE false END as has_sale,
  (sales.total_amount - sales.total_amount * 0.1) as estimated_profit -- Basic estimate
FROM deals
LEFT JOIN sales ON deals.id = sales.deal_id
WHERE deals.stage = 'Won' AND deals.deleted_at IS NULL
ORDER BY deals.created_at DESC;

-- ============================================================================
-- FUNCTION: Refresh metrics cache
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_pipeline_metrics(p_metric_date DATE DEFAULT CURRENT_DATE)
RETURNS void AS $$
BEGIN
  DELETE FROM pipeline_metrics_cache 
  WHERE metric_date = p_metric_date;
  
  INSERT INTO pipeline_metrics_cache (
    metric_date,
    metric_type,
    total_pipeline_value,
    won_deals_count,
    won_deals_value,
    pending_deals_count,
    pending_deals_value,
    lost_deals_count,
    lost_deals_value,
    stage_lead_count,
    stage_lead_value,
    stage_contacted_count,
    stage_contacted_value,
    stage_proposal_count,
    stage_proposal_value,
    stage_negotiation_count,
    stage_negotiation_value,
    avg_deal_value,
    weighted_pipeline_value,
    revenue_from_sales
  )
  SELECT 
    p_metric_date,
    'daily',
    SUM(value_estimate),
    COUNT(CASE WHEN stage = 'Won' THEN 1 END),
    SUM(CASE WHEN stage = 'Won' THEN value_estimate ELSE 0 END),
    COUNT(CASE WHEN stage IN ('Lead', 'Contacted', 'Proposal Sent', 'Negotiation') THEN 1 END),
    SUM(CASE WHEN stage IN ('Lead', 'Contacted', 'Proposal Sent', 'Negotiation') THEN value_estimate ELSE 0 END),
    COUNT(CASE WHEN stage = 'Lost' THEN 1 END),
    SUM(CASE WHEN stage = 'Lost' THEN value_estimate ELSE 0 END),
    COUNT(CASE WHEN stage = 'Lead' THEN 1 END),
    SUM(CASE WHEN stage = 'Lead' THEN value_estimate ELSE 0 END),
    COUNT(CASE WHEN stage = 'Contacted' THEN 1 END),
    SUM(CASE WHEN stage = 'Contacted' THEN value_estimate ELSE 0 END),
    COUNT(CASE WHEN stage = 'Proposal Sent' THEN 1 END),
    SUM(CASE WHEN stage = 'Proposal Sent' THEN value_estimate ELSE 0 END),
    COUNT(CASE WHEN stage = 'Negotiation' THEN 1 END),
    SUM(CASE WHEN stage = 'Negotiation' THEN value_estimate ELSE 0 END),
    AVG(value_estimate),
    SUM(value_estimate * probability / 100),
    (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE status = 'Paid' AND DATE(sale_date) = p_metric_date)
  FROM deals
  WHERE deleted_at IS NULL AND status = 'ACTIVE' AND DATE(created_at) <= p_metric_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUTO-REFRESH METRICS CACHE ON DEALS CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_refresh_metrics_on_deal_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh metrics for today
  PERFORM refresh_pipeline_metrics(CURRENT_DATE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_refresh_metrics ON deals;

CREATE TRIGGER auto_refresh_metrics
AFTER INSERT OR UPDATE OR DELETE ON deals
FOR EACH STATEMENT
EXECUTE FUNCTION auto_refresh_metrics_on_deal_change();

-- ============================================================================
-- FUNCTION: Get pipeline summary
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pipeline_summary(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  metric_name VARCHAR,
  metric_value DECIMAL,
  metric_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'Total Pipeline Value'::VARCHAR,
    total_pipeline_value,
    NULL::INTEGER
  FROM pipeline_metrics_cache
  WHERE metric_date = p_date AND metric_type = 'daily'
  
  UNION ALL
  
  SELECT 
    'Won Deals Value'::VARCHAR,
    won_deals_value,
    won_deals_count
  FROM pipeline_metrics_cache
  WHERE metric_date = p_date AND metric_type = 'daily'
  
  UNION ALL
  
  SELECT 
    'Pending Deals Value'::VARCHAR,
    pending_deals_value,
    pending_deals_count
  FROM pipeline_metrics_cache
  WHERE metric_date = p_date AND metric_type = 'daily'
  
  UNION ALL
  
  SELECT 
    'Revenue from Sales'::VARCHAR,
    revenue_from_sales,
    NULL::INTEGER
  FROM pipeline_metrics_cache
  WHERE metric_date = p_date AND metric_type = 'daily';
END;
$$ LANGUAGE plpgsql;
