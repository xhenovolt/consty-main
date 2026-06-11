-- Migration 301: Consty System Expansion
-- Date: 2026-03-11
-- Fixes: account type constraint, adds resources/cost-tracking/allocations/employees/media tables

-- ================================================
-- 1. FIX ACCOUNT TYPE CONSTRAINT
-- ================================================
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('bank','cash','mobile_money','credit_card','investment','escrow','savings','internal','salary','other'));

-- ================================================
-- 2. RESOURCES TABLE (business tools, infrastructure, hardware)
-- ================================================
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('business_tool','infrastructure','hardware')),
  description TEXT,
  cost NUMERIC(15,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  -- Business tool fields
  usage_notes TEXT,
  -- Infrastructure fields
  provider VARCHAR(255),
  renewal_date DATE,
  -- Hardware fields
  serial_number VARCHAR(255),
  assigned_to UUID REFERENCES staff(id),
  -- Common fields
  acquisition_date DATE,
  status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active','inactive','retired','pending','maintenance')),
  tags JSONB DEFAULT '{}',
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_assigned ON resources(assigned_to);

-- ================================================
-- 3. SYSTEM COST TRACKING
-- ================================================
CREATE TABLE IF NOT EXISTS system_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  cost_type VARCHAR(100) NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'UGX',
  cost_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_costs_system ON system_costs(system_id);
CREATE INDEX IF NOT EXISTS idx_system_costs_type ON system_costs(cost_type);

-- ================================================
-- 4. EXPAND STAFF TABLE → FULL EMPLOYEE MANAGEMENT
-- ================================================
DO $$ BEGIN
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS email VARCHAR(255);
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS department VARCHAR(100);
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS position VARCHAR(255);
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary NUMERIC(15,2);
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary_currency VARCHAR(10) DEFAULT 'UGX';
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary_account_id UUID REFERENCES accounts(id);
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES staff(id);
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS hire_date DATE;
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS photo_url TEXT;
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_staff_manager ON staff(manager_id);
CREATE INDEX IF NOT EXISTS idx_staff_department ON staff(department);

-- ================================================
-- 5. MEDIA / FILE MANAGEMENT
-- ================================================
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(500) NOT NULL,
  original_filename VARCHAR(500),
  mime_type VARCHAR(100),
  file_size BIGINT,
  storage_provider VARCHAR(50) DEFAULT 'cloudinary',
  cloudinary_account VARCHAR(100),
  public_id VARCHAR(500),
  url TEXT NOT NULL,
  secure_url TEXT,
  thumbnail_url TEXT,
  width INT,
  height INT,
  format VARCHAR(20),
  -- Linked entity
  entity_type VARCHAR(50),
  entity_id UUID,
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  quality VARCHAR(20) DEFAULT 'original' CHECK (quality IN ('original','optimized')),
  upload_source VARCHAR(50) DEFAULT 'manual',
  notes TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_entity ON media(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_media_tags ON media USING GIN(tags);

-- ================================================
-- 6. MONEY ALLOCATIONS (enhanced)
-- ================================================
DO $$ BEGIN
  ALTER TABLE allocations ADD COLUMN IF NOT EXISTS resource_type VARCHAR(50);
  ALTER TABLE allocations ADD COLUMN IF NOT EXISTS resource_id UUID;
  ALTER TABLE allocations ADD COLUMN IF NOT EXISTS source_account_id UUID REFERENCES accounts(id);
EXCEPTION WHEN others THEN NULL;
END $$;

-- ================================================
-- 7. CLOUDINARY ACCOUNTS CONFIG
-- ================================================
CREATE TABLE IF NOT EXISTS cloud_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL DEFAULT 'cloudinary',
  account_name VARCHAR(100) NOT NULL,
  cloud_name VARCHAR(100) NOT NULL,
  api_key VARCHAR(255) NOT NULL,
  api_secret VARCHAR(255) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_bytes BIGINT DEFAULT 0,
  max_bytes BIGINT DEFAULT 10737418240, -- 10GB default
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Done
SELECT 'Migration 301 complete' as status;
