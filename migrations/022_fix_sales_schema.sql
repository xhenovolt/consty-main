-- Migration: Fix sales table schema
-- Add missing columns: product_service, quantity, unit_price, sale_date
-- Add missing salesperson_id column mapping

-- Add missing columns if they don't exist
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS product_service VARCHAR(255),
ADD COLUMN IF NOT EXISTS quantity INTEGER,
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(19, 4),
ADD COLUMN IF NOT EXISTS sale_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(19, 2),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sales_customer_name ON sales(customer_name);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_deal_id ON sales(deal_id);
CREATE INDEX IF NOT EXISTS idx_sales_salesperson_id ON sales(salesperson_id);
