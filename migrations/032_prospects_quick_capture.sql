-- Migration 032: Prospects Quick Capture & System Attachment
-- Adds pipeline attachment, optional follow-up time, and quick-capture title alias.

-- 1. Add pipeline (system attachment) — nullable text label
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS pipeline VARCHAR(100);

-- 2. Add optional follow-up time (separate from date so neither is forced)
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS next_followup_time TIME;

-- Index for pipeline filtering
CREATE INDEX IF NOT EXISTS idx_prospects_pipeline ON prospects(pipeline);
CREATE INDEX IF NOT EXISTS idx_prospects_followup_date ON prospects(next_followup_date);

-- 3. Change currency default to UGX
ALTER TABLE prospects
  ALTER COLUMN currency SET DEFAULT 'UGX';

-- 4. Make company_name non-required at DB level (title is always set by app)
--    (company_name NOT NULL cannot easily be dropped with IF, check first)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prospects' AND column_name = 'company_name' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE prospects ALTER COLUMN company_name DROP NOT NULL;
  END IF;
END$$;

-- 5. Add estimated_value_raw (human text like "700k", "5M") alongside the numeric field
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS estimated_value_text VARCHAR(100);
