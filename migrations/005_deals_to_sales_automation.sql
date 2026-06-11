/**
 * Migration: Add deal-to-sales automation
 * 
 * Creates trigger to automatically generate Sales records when deals are Won
 * Adds necessary indexes for pipeline reporting
 */

-- ============================================================================
-- ADD DEAL-TO-SALES AUTOMATION TRIGGER
-- ============================================================================

/**
 * Trigger: create_sale_from_won_deal
 * 
 * When a deal status changes to 'Won', automatically create a Sales record
 * with details from the deal. This ensures every won deal has a corresponding
 * sales record for revenue tracking.
 * 
 * Prevents duplicates by checking if a sale already exists for this deal_id
 */
CREATE OR REPLACE FUNCTION create_sale_from_won_deal()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when stage changes to 'Won' (transition from another stage)
  IF NEW.stage = 'Won' AND (OLD.stage IS NULL OR OLD.stage != 'Won') THEN
    
    -- Check if a sale already exists for this deal to prevent duplicates
    IF NOT EXISTS (SELECT 1 FROM sales WHERE deal_id = NEW.id) THEN
      INSERT INTO sales (
        deal_id,
        customer_name,
        customer_email,
        product_service,
        quantity,
        unit_price,
        sale_date,
        status,
        currency,
        notes,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        COALESCE(NEW.client_name, 'Unknown Customer'),
        NULL, -- Email not stored in deals table
        NEW.title,
        1, -- Default quantity
        GREATEST(0, COALESCE(NEW.value_estimate, 0)), -- Use deal value as unit price
        CURRENT_TIMESTAMP, -- Sale date is today
        'Pending', -- New sales start as Pending
        'UGX', -- System default currency
        CONCAT('Created from won deal #', NEW.id),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
      
      -- Log this action for audit trail
      INSERT INTO audit_logs (
        action,
        entity,
        entity_id,
        details,
        created_at
      ) VALUES (
        'DEAL_WON_SALES_CREATED',
        'sales',
        (SELECT id FROM sales WHERE deal_id = NEW.id LIMIT 1),
        CONCAT('Auto-created from won deal ', NEW.id),
        CURRENT_TIMESTAMP
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS deal_won_sales_trigger ON deals;

-- Create the trigger to fire AFTER update on deals
CREATE TRIGGER deal_won_sales_trigger
AFTER UPDATE ON deals
FOR EACH ROW
EXECUTE FUNCTION create_sale_from_won_deal();

-- ============================================================================
-- ADD INDEXES FOR PIPELINE REPORTING
-- ============================================================================

-- Index for filtering by deal owner (staff member)
CREATE INDEX IF NOT EXISTS idx_deals_created_by_stage 
ON deals(created_by, stage) 
WHERE deleted_at IS NULL;

-- Index for date-based pipeline reporting
CREATE INDEX IF NOT EXISTS idx_deals_expected_close_stage 
ON deals(expected_close_date, stage) 
WHERE deleted_at IS NULL;

-- Index for probability-weighted calculations
CREATE INDEX IF NOT EXISTS idx_deals_stage_probability 
ON deals(stage, probability) 
WHERE deleted_at IS NULL;

-- Index for quick stage grouping with values
CREATE INDEX IF NOT EXISTS idx_deals_stage_value 
ON deals(stage, value_estimate) 
WHERE deleted_at IS NULL AND status = 'ACTIVE';

-- Index for finding won deals for reporting
CREATE INDEX IF NOT EXISTS idx_deals_won_deals 
ON deals(stage, created_at) 
WHERE stage = 'Won' AND deleted_at IS NULL;

-- ============================================================================
-- ADD FOREIGN KEY TO LINK EXISTING SALES TO DEALS (if not already present)
-- ============================================================================

-- Note: sales.deal_id should already exist from create_sales_tables.sql
-- If it doesn't, add it with:
-- ALTER TABLE sales ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;

-- ============================================================================
-- CREATE SALES_TO_DEAL TRACKING TABLE (optional, for audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_sales_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  auto_created BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(deal_id, sale_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_sales_mapping_deal 
ON deal_sales_mapping(deal_id);

CREATE INDEX IF NOT EXISTS idx_deal_sales_mapping_sale 
ON deal_sales_mapping(sale_id);

-- ============================================================================
-- TRIGGER: Track deal-to-sales creation in mapping table
-- ============================================================================

CREATE OR REPLACE FUNCTION track_deal_sales_mapping()
RETURNS TRIGGER AS $$
BEGIN
  -- If a sale was created with a deal_id, track it
  IF NEW.deal_id IS NOT NULL THEN
    INSERT INTO deal_sales_mapping (deal_id, sale_id, auto_created)
    VALUES (NEW.deal_id, NEW.id, true)
    ON CONFLICT (deal_id, sale_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_sales_deal_mapping ON sales;

CREATE TRIGGER track_sales_deal_mapping
AFTER INSERT ON sales
FOR EACH ROW
EXECUTE FUNCTION track_deal_sales_mapping();
