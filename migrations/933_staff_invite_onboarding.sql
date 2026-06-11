-- Migration 933: Staff Invite & Onboarding
-- Adds invite_token, onboarding_status, and 'invited' status to staff for onboarding/claim flow

ALTER TABLE staff ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(16) DEFAULT 'pending';

-- Allow 'invited' as a valid status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_status_enum') THEN
    CREATE TYPE staff_status_enum AS ENUM ('active', 'pending', 'suspended', 'terminated', 'invited');
    ALTER TABLE staff ALTER COLUMN status TYPE staff_status_enum USING status::text::staff_status_enum;
  ELSE
    BEGIN
      ALTER TYPE staff_status_enum ADD VALUE IF NOT EXISTS 'invited';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;
