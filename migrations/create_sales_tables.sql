-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  product_service VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(19, 4) NOT NULL CHECK (unit_price >= 0),
  total_amount DECIMAL(19, 2) NOT NULL DEFAULT 0,
  sale_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid', 'Partially Paid')),
  currency VARCHAR(10) NOT NULL DEFAULT 'UGX',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sales payments table
CREATE TABLE IF NOT EXISTS sales_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL,
  amount DECIMAL(19, 2) NOT NULL CHECK (amount > 0),
  payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Mobile Money', 'Other')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_sales_customer_name ON sales(customer_name);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_sale_date ON sales(sale_date);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sales_deal_id ON sales(deal_id);
CREATE INDEX idx_sales_payments_sale_id ON sales_payments(sale_id);
CREATE INDEX idx_sales_payments_payment_date ON sales_payments(payment_date);

-- Create trigger to auto-update updated_at on sales table
CREATE OR REPLACE FUNCTION update_sales_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sales_update_timestamp
BEFORE UPDATE ON sales
FOR EACH ROW
EXECUTE FUNCTION update_sales_timestamp();

-- Create trigger to auto-update updated_at on sales_payments table
CREATE OR REPLACE FUNCTION update_sales_payments_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sales_payments_update_timestamp
BEFORE UPDATE ON sales_payments
FOR EACH ROW
EXECUTE FUNCTION update_sales_payments_timestamp();

-- Create trigger to auto-calculate total_amount when inserting/updating sales
CREATE OR REPLACE FUNCTION calculate_sales_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_amount = NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sales_calculate_total
BEFORE INSERT OR UPDATE ON sales
FOR EACH ROW
EXECUTE FUNCTION calculate_sales_total();

-- Create trigger to auto-update sales status based on payments
CREATE OR REPLACE FUNCTION update_sales_status()
RETURNS TRIGGER AS $$
DECLARE
  total_paid DECIMAL(19, 2);
  total_amount DECIMAL(19, 2);
BEGIN
  SELECT s.total_amount INTO total_amount FROM sales s WHERE s.id = NEW.sale_id;
  SELECT COALESCE(SUM(sp.amount), 0) INTO total_paid FROM sales_payments sp WHERE sp.sale_id = NEW.sale_id;
  
  IF total_paid >= total_amount THEN
    UPDATE sales SET status = 'Paid' WHERE id = NEW.sale_id;
  ELSIF total_paid > 0 THEN
    UPDATE sales SET status = 'Partially Paid' WHERE id = NEW.sale_id;
  ELSE
    UPDATE sales SET status = 'Pending' WHERE id = NEW.sale_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sales_update_status
AFTER INSERT OR UPDATE OR DELETE ON sales_payments
FOR EACH ROW
EXECUTE FUNCTION update_sales_status();
