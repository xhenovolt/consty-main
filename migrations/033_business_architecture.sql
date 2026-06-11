-- ╔══════════════════════════════════════════════════════╗
-- ║   MIGRATION 033: BUSINESS ARCHITECTURE               ║
-- ║   Consty Core: Systems, Licensing, IP, Staff         ║
-- ╚══════════════════════════════════════════════════════╝

-- 1. SYSTEMS — software products managed in Consty
CREATE TABLE IF NOT EXISTS systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, development, deprecated, archived
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SYSTEM ISSUES — bugs and operational problems per system
CREATE TABLE IF NOT EXISTS system_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'open', -- open, investigating, fixed, closed
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 3. SYSTEM CHANGES — improvements and planned features
CREATE TABLE IF NOT EXISTS system_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'planned', -- planned, in_progress, completed, cancelled
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 4. LICENSES — who owns which system and under what terms
CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID REFERENCES systems(id),
  deal_id UUID REFERENCES deals(id),
  client_name VARCHAR(255) NOT NULL,
  license_type VARCHAR(100) NOT NULL DEFAULT 'lifetime', -- lifetime, annual, monthly
  start_date DATE,
  end_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, expired, suspended, revoked
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PRODUCTS — templates, reports, consulting packages, data services
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(15,2),
  currency VARCHAR(10) DEFAULT 'UGX',
  category VARCHAR(100), -- template, report, consulting, data_service, other
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. INTELLECTUAL PROPERTY — company IP assets
CREATE TABLE IF NOT EXISTS intellectual_property (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100), -- algorithm, platform, design, brand, process
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ASSETS — company assets
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  value NUMERIC(15,2),
  currency VARCHAR(10) DEFAULT 'UGX',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. LIABILITIES — company obligations
CREATE TABLE IF NOT EXISTS liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  amount NUMERIC(15,2),
  currency VARCHAR(10) DEFAULT 'UGX',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. STAFF — team members
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  role VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, inactive, contractor
  joined_at DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Extend deals to support system-based licensing deals
ALTER TABLE deals ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS system_id UUID REFERENCES systems(id);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS client_name VARCHAR(255);
