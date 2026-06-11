-- Migration 024: Unified Revenue Model (Deal = Sale SSOT)
-- Adds revenue_records, revenue_payments, revenue_receivables, prospects,
-- and synchronization logic between deals and sales.

-- 1) Harden sales table for compatibility across old/new schemas
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS amount DECIMAL(19, 2),
  ADD COLUMN IF NOT EXISTS total_paid DECIMAL(19, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_balance DECIMAL(19, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'Unpaid';

UPDATE sales
SET amount = COALESCE(amount, total_amount, quantity * unit_price, 0)
WHERE amount IS NULL;

UPDATE sales
SET total_amount = COALESCE(total_amount, amount, quantity * unit_price, 0)
WHERE total_amount IS NULL;

-- 2) Unified revenue table
CREATE TABLE IF NOT EXISTS revenue_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID UNIQUE REFERENCES deals(id) ON DELETE SET NULL,
  sale_id UUID UNIQUE REFERENCES sales(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'deal' CHECK (type IN ('deal', 'sale')),
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'partially_paid', 'credit', 'paid')),
  stage VARCHAR(80),
  title VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  amount_total DECIMAL(19, 2) NOT NULL DEFAULT 0,
  amount_received DECIMAL(19, 2) NOT NULL DEFAULT 0,
  amount_outstanding DECIMAL(19, 2) NOT NULL DEFAULT 0,
  probability DECIMAL(5, 2) DEFAULT 0,
  weighted_value DECIMAL(19, 2) DEFAULT 0,
  expected_revenue DECIMAL(19, 2) DEFAULT 0,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Partially Paid', 'Paid', 'Credit', 'Overdue')),
  on_credit BOOLEAN NOT NULL DEFAULT FALSE,
  due_date DATE,
  follow_up_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_revenue_records_status ON revenue_records(status);
CREATE INDEX IF NOT EXISTS idx_revenue_records_payment_status ON revenue_records(payment_status);
CREATE INDEX IF NOT EXISTS idx_revenue_records_due_date ON revenue_records(due_date);
CREATE INDEX IF NOT EXISTS idx_revenue_records_customer_name ON revenue_records(customer_name);

CREATE TABLE IF NOT EXISTS revenue_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revenue_id UUID NOT NULL REFERENCES revenue_records(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  amount DECIMAL(19, 2) NOT NULL CHECK (amount > 0),
  payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'Other',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_revenue_payments_revenue_id ON revenue_payments(revenue_id);
CREATE INDEX IF NOT EXISTS idx_revenue_payments_payment_date ON revenue_payments(payment_date);

CREATE TABLE IF NOT EXISTS revenue_receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revenue_id UUID NOT NULL REFERENCES revenue_records(id) ON DELETE CASCADE,
  amount_due DECIMAL(19, 2) NOT NULL CHECK (amount_due >= 0),
  due_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Partially Paid', 'Settled', 'Overdue')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_revenue_receivables_due_date ON revenue_receivables(due_date);
CREATE INDEX IF NOT EXISTS idx_revenue_receivables_status ON revenue_receivables(status);

-- 3) Prospecting table (Sales Notebook)
CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  business_name VARCHAR(255),
  address TEXT,
  industry VARCHAR(120),
  source VARCHAR(80),
  product_discussed TEXT,
  conversation_notes TEXT,
  objections TEXT,
  estimated_budget DECIMAL(19, 2) DEFAULT 0,
  follow_up_date DATE,
  sales_stage VARCHAR(50) NOT NULL DEFAULT 'Prospect' CHECK (sales_stage IN ('Prospect', 'Contacted', 'Interested', 'Negotiating', 'Converted')),
  status VARCHAR(40) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Converted', 'Archived')),
  converted_deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  converted_revenue_id UUID REFERENCES revenue_records(id) ON DELETE SET NULL,
  converted_customer_name VARCHAR(255),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prospects_stage ON prospects(sales_stage);
CREATE INDEX IF NOT EXISTS idx_prospects_follow_up_date ON prospects(follow_up_date);

-- 4) Timestamps
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_revenue_records_updated_at ON revenue_records;
CREATE TRIGGER trg_revenue_records_updated_at
BEFORE UPDATE ON revenue_records
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_revenue_payments_updated_at ON revenue_payments;
CREATE TRIGGER trg_revenue_payments_updated_at
BEFORE UPDATE ON revenue_payments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_revenue_receivables_updated_at ON revenue_receivables;
CREATE TRIGGER trg_revenue_receivables_updated_at
BEFORE UPDATE ON revenue_receivables
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_prospects_updated_at ON prospects;
CREATE TRIGGER trg_prospects_updated_at
BEFORE UPDATE ON prospects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- 5) Helper to recompute payment state
CREATE OR REPLACE FUNCTION refresh_revenue_payment_state(p_revenue_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total DECIMAL(19,2);
  v_paid DECIMAL(19,2);
  v_due_date DATE;
  v_on_credit BOOLEAN;
  v_status VARCHAR(30);
  v_payment_status VARCHAR(30);
BEGIN
  SELECT amount_total, COALESCE(SUM(rp.amount), 0), due_date, on_credit
  INTO v_total, v_paid, v_due_date, v_on_credit
  FROM revenue_records rr
  LEFT JOIN revenue_payments rp ON rr.id = rp.revenue_id
  WHERE rr.id = p_revenue_id
  GROUP BY rr.id;

  IF v_total IS NULL THEN
    RETURN;
  END IF;

  IF v_paid >= v_total AND v_total > 0 THEN
    v_status := 'paid';
    v_payment_status := 'Paid';
  ELSIF v_paid > 0 THEN
    v_status := 'partially_paid';
    v_payment_status := 'Partially Paid';
  ELSIF v_on_credit THEN
    v_status := 'credit';
    IF v_due_date IS NOT NULL AND v_due_date < CURRENT_DATE THEN
      v_payment_status := 'Overdue';
    ELSE
      v_payment_status := 'Credit';
    END IF;
  ELSE
    v_payment_status := 'Unpaid';
  END IF;

  UPDATE revenue_records
  SET amount_received = v_paid,
      amount_outstanding = GREATEST(v_total - v_paid, 0),
      status = CASE WHEN status = 'won' AND v_paid = 0 AND NOT v_on_credit THEN 'won' ELSE COALESCE(v_status, status) END,
      payment_status = COALESCE(v_payment_status, payment_status),
      weighted_value = amount_total * COALESCE(probability, 0) / 100,
      expected_revenue = amount_total
  WHERE id = p_revenue_id;

  -- Keep sales table synchronized for compatibility
  UPDATE sales s
  SET total_paid = rr.amount_received,
      remaining_balance = rr.amount_outstanding,
      payment_status = rr.payment_status,
      status = CASE
        WHEN rr.payment_status = 'Paid' THEN 'Paid'
        WHEN rr.payment_status = 'Partially Paid' THEN 'Partially Paid'
        ELSE 'Pending'
      END
  FROM revenue_records rr
  WHERE rr.id = p_revenue_id
    AND s.id = rr.sale_id;

  -- Mark receivables status
  UPDATE revenue_receivables rc
  SET status = CASE
    WHEN rr.amount_outstanding <= 0 THEN 'Settled'
    WHEN rr.amount_received > 0 THEN 'Partially Paid'
    WHEN rc.due_date < CURRENT_DATE THEN 'Overdue'
    ELSE 'Open'
  END
  FROM revenue_records rr
  WHERE rc.revenue_id = rr.id AND rr.id = p_revenue_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION on_revenue_payment_change()
RETURNS TRIGGER AS $$
DECLARE
  v_revenue_id UUID;
BEGIN
  v_revenue_id := COALESCE(NEW.revenue_id, OLD.revenue_id);
  PERFORM refresh_revenue_payment_state(v_revenue_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_revenue_payment_change ON revenue_payments;
CREATE TRIGGER trg_revenue_payment_change
AFTER INSERT OR UPDATE OR DELETE ON revenue_payments
FOR EACH ROW
EXECUTE FUNCTION on_revenue_payment_change();

-- 6) Deal/Sale synchronization
CREATE OR REPLACE FUNCTION ensure_revenue_from_deal()
RETURNS TRIGGER AS $$
DECLARE
  v_revenue_id UUID;
BEGIN
  -- Ensure revenue record always exists for deal lifecycle
  INSERT INTO revenue_records (
    deal_id,
    type,
    status,
    stage,
    title,
    customer_name,
    amount_total,
    probability,
    weighted_value,
    expected_revenue,
    payment_status,
    on_credit,
    due_date,
    metadata
  ) VALUES (
    NEW.id,
    'deal',
    CASE
      WHEN NEW.stage = 'Won' THEN 'won'
      WHEN NEW.stage = 'Lost' THEN 'lost'
      ELSE 'open'
    END,
    NEW.stage,
    NEW.title,
    COALESCE(NEW.client_name, 'Unknown Customer'),
    COALESCE(NEW.value_estimate, 0),
    COALESCE(NEW.probability, 0),
    COALESCE(NEW.value_estimate, 0) * COALESCE(NEW.probability, 0) / 100,
    COALESCE(NEW.value_estimate, 0),
    CASE WHEN NEW.stage = 'Won' THEN 'Credit' ELSE 'Unpaid' END,
    CASE WHEN NEW.stage = 'Won' THEN TRUE ELSE FALSE END,
    NEW.expected_close_date::date,
    jsonb_build_object('source', 'deal_trigger')
  )
  ON CONFLICT (deal_id)
  DO UPDATE SET
    stage = EXCLUDED.stage,
    title = EXCLUDED.title,
    customer_name = EXCLUDED.customer_name,
    amount_total = EXCLUDED.amount_total,
    probability = EXCLUDED.probability,
    weighted_value = EXCLUDED.weighted_value,
    expected_revenue = EXCLUDED.expected_revenue,
    status = CASE
      WHEN EXCLUDED.stage = 'Won' AND revenue_records.status = 'open' THEN 'won'
      WHEN EXCLUDED.stage = 'Lost' THEN 'lost'
      WHEN EXCLUDED.stage NOT IN ('Won', 'Lost') THEN 'open'
      ELSE revenue_records.status
    END,
    due_date = COALESCE(EXCLUDED.due_date, revenue_records.due_date);

  SELECT id INTO v_revenue_id FROM revenue_records WHERE deal_id = NEW.id;

  -- If deal moved to won and no sale exists, create sale automatically
  IF NEW.stage = 'Won' THEN
    INSERT INTO sales (
      deal_id,
      customer_name,
      customer_email,
      product_service,
      quantity,
      unit_price,
      amount,
      total_amount,
      sale_date,
      status,
      currency,
      notes,
      due_date,
      total_paid,
      remaining_balance,
      payment_status,
      created_at,
      updated_at
    )
    SELECT
      NEW.id,
      COALESCE(NEW.client_name, 'Unknown Customer'),
      NULL,
      NEW.title,
      1,
      GREATEST(0, COALESCE(NEW.value_estimate, 0)),
      GREATEST(0, COALESCE(NEW.value_estimate, 0)),
      GREATEST(0, COALESCE(NEW.value_estimate, 0)),
      CURRENT_TIMESTAMP,
      'Pending',
      'UGX',
      CONCAT('Auto-created from won deal #', NEW.id),
      (CURRENT_DATE + INTERVAL '30 day')::date,
      0,
      GREATEST(0, COALESCE(NEW.value_estimate, 0)),
      'Credit',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.deal_id = NEW.id);

    UPDATE revenue_records rr
    SET sale_id = s.id,
        type = 'sale',
        on_credit = TRUE,
        status = CASE WHEN rr.amount_received > 0 THEN 'partially_paid' ELSE 'credit' END,
        payment_status = CASE WHEN rr.amount_received > 0 THEN 'Partially Paid' ELSE 'Credit' END,
        due_date = COALESCE(rr.due_date, (CURRENT_DATE + INTERVAL '30 day')::date)
    FROM sales s
    WHERE rr.id = v_revenue_id
      AND s.deal_id = NEW.id;

    -- ensure receivable exists for credit won deal
    INSERT INTO revenue_receivables (revenue_id, amount_due, due_date, status, notes)
    SELECT rr.id, rr.amount_outstanding, COALESCE(rr.due_date, (CURRENT_DATE + INTERVAL '30 day')::date),
           CASE WHEN rr.amount_outstanding > 0 THEN 'Open' ELSE 'Settled' END,
           'Auto-generated from won deal on credit'
    FROM revenue_records rr
    WHERE rr.deal_id = NEW.id
      AND rr.amount_outstanding > 0
      AND NOT EXISTS (SELECT 1 FROM revenue_receivables rc WHERE rc.revenue_id = rr.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_revenue_from_deal_insert ON deals;
CREATE TRIGGER trg_ensure_revenue_from_deal_insert
AFTER INSERT ON deals
FOR EACH ROW EXECUTE FUNCTION ensure_revenue_from_deal();

DROP TRIGGER IF EXISTS trg_ensure_revenue_from_deal_update ON deals;
CREATE TRIGGER trg_ensure_revenue_from_deal_update
AFTER UPDATE ON deals
FOR EACH ROW EXECUTE FUNCTION ensure_revenue_from_deal();

-- 7) Backfill from existing deals
INSERT INTO revenue_records (
  deal_id,
  type,
  status,
  stage,
  title,
  customer_name,
  amount_total,
  probability,
  weighted_value,
  expected_revenue,
  payment_status,
  on_credit,
  due_date,
  metadata
)
SELECT
  d.id,
  CASE WHEN s.id IS NULL THEN 'deal' ELSE 'sale' END,
  CASE
    WHEN d.stage = 'Lost' THEN 'lost'
    WHEN d.stage = 'Won' AND COALESCE(s.total_paid, 0) >= COALESCE(s.total_amount, d.value_estimate, 0) THEN 'paid'
    WHEN d.stage = 'Won' AND COALESCE(s.total_paid, 0) > 0 THEN 'partially_paid'
    WHEN d.stage = 'Won' THEN 'credit'
    ELSE 'open'
  END,
  d.stage,
  d.title,
  COALESCE(d.client_name, 'Unknown Customer'),
  COALESCE(d.value_estimate, 0),
  COALESCE(d.probability, 0),
  COALESCE(d.value_estimate, 0) * COALESCE(d.probability, 0) / 100,
  COALESCE(d.value_estimate, 0),
  CASE
    WHEN d.stage = 'Won' AND COALESCE(s.total_paid, 0) >= COALESCE(s.total_amount, d.value_estimate, 0) THEN 'Paid'
    WHEN d.stage = 'Won' AND COALESCE(s.total_paid, 0) > 0 THEN 'Partially Paid'
    WHEN d.stage = 'Won' THEN 'Credit'
    ELSE 'Unpaid'
  END,
  CASE WHEN d.stage = 'Won' AND COALESCE(s.total_paid, 0) < COALESCE(s.total_amount, d.value_estimate, 0) THEN TRUE ELSE FALSE END,
  COALESCE(s.due_date, d.expected_close_date::date, (CURRENT_DATE + INTERVAL '30 day')::date),
  jsonb_build_object('source', 'backfill')
FROM deals d
LEFT JOIN sales s ON s.deal_id = d.id
WHERE d.deleted_at IS NULL
ON CONFLICT (deal_id) DO NOTHING;

-- Link revenue to corresponding sales + synced amounts
UPDATE revenue_records rr
SET sale_id = s.id,
    amount_received = COALESCE(s.total_paid, 0),
    amount_outstanding = GREATEST(rr.amount_total - COALESCE(s.total_paid, 0), 0)
FROM sales s
WHERE s.deal_id = rr.deal_id;

-- 8) Backfill payments from legacy sales_payments
INSERT INTO revenue_payments (revenue_id, sale_id, amount, payment_date, payment_method, notes, created_at, updated_at)
SELECT rr.id, sp.sale_id, sp.amount, sp.payment_date, sp.payment_method, sp.notes, sp.created_at, sp.updated_at
FROM sales_payments sp
JOIN sales s ON s.id = sp.sale_id
JOIN revenue_records rr ON rr.deal_id = s.deal_id
WHERE NOT EXISTS (
  SELECT 1 FROM revenue_payments rp
  WHERE rp.sale_id = sp.sale_id
    AND rp.amount = sp.amount
    AND rp.payment_date = sp.payment_date
);

-- 9) Refresh all payment states
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM revenue_records LOOP
    PERFORM refresh_revenue_payment_state(r.id);
  END LOOP;
END$$;
