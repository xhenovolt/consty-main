-- =============================================================================
-- MIGRATION 947: MULTI-CURRENCY FINANCIAL ENGINE COMPLETE (FIXED)
-- =============================================================================

-- ============================================================================
-- SECTION 1: ADD MULTI-CURRENCY TRACKING COLUMNS TO PAYMENTS
-- ============================================================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS original_amount DECIMAL(15, 2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS original_currency VARCHAR(3);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_ugx DECIMAL(15, 2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(15, 6);

-- Backfill original_amount and original_currency from existing payments
UPDATE payments SET original_amount = COALESCE(original_amount, amount), original_currency = COALESCE(original_currency, COALESCE(currency, 'UGX')) WHERE original_amount IS NULL OR original_currency IS NULL;

-- Make them NOT NULL after backfill
ALTER TABLE payments ALTER COLUMN original_amount SET NOT NULL, ALTER COLUMN original_currency SET NOT NULL;

-- Ensure amount_ugx is always populated
UPDATE payments SET amount_ugx = CASE WHEN currency = 'UGX' THEN amount ELSE (original_amount * COALESCE(exchange_rate, 1.0)) END WHERE amount_ugx IS NULL;

-- Create index for currency filtering and reporting
CREATE INDEX IF NOT EXISTS idx_payments_original_currency ON payments(original_currency);
CREATE INDEX IF NOT EXISTS idx_payments_amount_ugx ON payments(amount_ugx);

-- ============================================================================
-- SECTION 2: DATA MIGRATION - FIX EXISTING USD ENTRIES
-- ============================================================================

UPDATE payments SET original_amount = amount, original_currency = currency, amount_ugx = CASE WHEN currency != 'UGX' AND amount_ugx IS NULL THEN amount * COALESCE(exchange_rate, 1.0) WHEN currency = 'UGX' THEN amount ELSE COALESCE(amount_ugx, amount) END WHERE (currency != 'UGX' OR amount_ugx IS NULL) AND original_amount IS NULL;

-- ============================================================================
-- SECTION 3: ENSURE PAYMENT VALIDATION
-- ============================================================================

ALTER TABLE payments ADD CONSTRAINT check_payment_currency_required CHECK (currency IS NOT NULL AND currency != '');
ALTER TABLE payments ADD CONSTRAINT check_payment_exchange_rate_positive CHECK (exchange_rate IS NULL OR exchange_rate > 0);

-- ============================================================================
-- SECTION 4: EXCHANGE RATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS exchange_rates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), from_currency VARCHAR(3) NOT NULL, to_currency VARCHAR(3) NOT NULL, rate DECIMAL(15, 6) NOT NULL CHECK (rate > 0), effective_date DATE NOT NULL DEFAULT CURRENT_DATE, source VARCHAR(100) DEFAULT 'manual', notes TEXT, is_current BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(from_currency, to_currency, effective_date));

CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_effective_date ON exchange_rates(effective_date);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_is_current ON exchange_rates(is_current);

-- Pre-populate common rates
INSERT INTO exchange_rates (from_currency, to_currency, rate, source, notes) VALUES ('USD', 'UGX', 3700.00, 'system', 'Initial rate - March 2026');
INSERT INTO exchange_rates (from_currency, to_currency, rate, source, notes) VALUES ('EUR', 'UGX', 4050.00, 'system', 'Initial rate - March 2026');
INSERT INTO exchange_rates (from_currency, to_currency, rate, source, notes) VALUES ('GBP', 'UGX', 4600.00, 'system', 'Initial rate - March 2026');
INSERT INTO exchange_rates (from_currency, to_currency, rate, source, notes) VALUES ('KES', 'UGX', 28.50, 'system', 'Initial rate - March 2026');

-- ============================================================================
-- SECTION 5: LEDGER ENHANCEMENTS FOR MULTI-CURRENCY
-- ============================================================================

ALTER TABLE ledger ADD COLUMN IF NOT EXISTS original_currency VARCHAR(3);
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(15, 6);

-- ============================================================================
-- SECTION 6: SCHEMA TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_versions (id SERIAL PRIMARY KEY, version_number INT NOT NULL UNIQUE, migration_name VARCHAR(255) NOT NULL, description TEXT, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

INSERT INTO schema_versions (version_number, migration_name, description) VALUES (947, 'migration_947_multi_currency_engine', 'Added multi-currency support with original amount immutability');
