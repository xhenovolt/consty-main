-- Create shares table
CREATE TABLE IF NOT EXISTS shares (
  id SERIAL PRIMARY KEY,
  total_shares BIGINT NOT NULL DEFAULT 1000000,
  par_value DECIMAL(19, 2) DEFAULT 1.00,
  class_type VARCHAR(50) DEFAULT 'common',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create share allocations table
CREATE TABLE IF NOT EXISTS share_allocations (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  owner_email VARCHAR(255),
  shares_allocated BIGINT NOT NULL,
  allocation_date DATE DEFAULT CURRENT_DATE,
  vesting_start_date DATE,
  vesting_end_date DATE,
  vesting_percentage DECIMAL(5, 2) DEFAULT 100.00,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create share price history table
CREATE TABLE IF NOT EXISTS share_price_history (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  opening_price DECIMAL(19, 4),
  closing_price DECIMAL(19, 4) NOT NULL,
  high_price DECIMAL(19, 4),
  low_price DECIMAL(19, 4),
  company_valuation DECIMAL(19, 2),
  total_shares BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_share_allocations_owner ON share_allocations(owner_id);
CREATE INDEX idx_share_allocations_status ON share_allocations(status);
CREATE INDEX idx_share_price_date ON share_price_history(date);

-- Create trigger to update share_allocations.updated_at
CREATE OR REPLACE FUNCTION update_share_allocations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER share_allocations_update_timestamp
BEFORE UPDATE ON share_allocations
FOR EACH ROW
EXECUTE FUNCTION update_share_allocations_timestamp();

-- Insert default shares record if not exists
INSERT INTO shares (total_shares, class_type, status)
VALUES (1000000, 'common', 'active')
ON CONFLICT DO NOTHING;
