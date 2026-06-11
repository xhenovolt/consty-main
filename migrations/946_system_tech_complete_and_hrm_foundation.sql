-- =============================================================================
-- MIGRATION 946: COMPLETE SYSTEM TECH STACK & HRM FOUNDATION
--
-- Enhancements:
-- - Expand system_tech_stack with version tracking and hosting
-- - Add system_modules table for module tracking
-- - Create employee_accounts table for tracking employee account balances
-- - Create payouts table for recording employee payments
-- - Enhance staff table with additional HR fields
-- =============================================================================

-- ============================================================================
-- SECTION 1: COMPLETE TECH STACK ENHANCEMENT
-- ============================================================================

-- Create system_tech_profiles table if it doesn't exist
-- If system_tech_stack exists from previous migration, we'll leave it as-is
-- and populate system_tech_profiles going forward
CREATE TABLE IF NOT EXISTS system_tech_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
    language VARCHAR(100),
    framework VARCHAR(100),
    framework_version VARCHAR(50),
    database VARCHAR(100),
    db_version VARCHAR(50),
    platform VARCHAR(100),
    hosting VARCHAR(100),
    deployment_url VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_tech_profiles_system_id ON system_tech_profiles(system_id);
CREATE INDEX IF NOT EXISTS idx_system_tech_profiles_created_at ON system_tech_profiles(created_at);

-- ============================================================================
-- SECTION 2: SYSTEM MODULES TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
    module_name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated', 'planned')),
    module_url VARCHAR(500),
    version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_modules_system_id ON system_modules(system_id);
CREATE INDEX IF NOT EXISTS idx_system_modules_status ON system_modules(status);
CREATE INDEX IF NOT EXISTS idx_system_modules_created_at ON system_modules(created_at);

-- ============================================================================
-- SECTION 3: EMPLOYEE ACCOUNTS (Track individual employee balances)
-- ============================================================================

CREATE TABLE IF NOT EXISTS employee_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL UNIQUE REFERENCES staff(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'UGX',
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_accounts_staff_id ON employee_accounts(staff_id);
CREATE INDEX IF NOT EXISTS idx_employee_accounts_account_id ON employee_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_employee_accounts_status ON employee_accounts(status);

-- ============================================================================
-- SECTION 4: PAYOUTS (Employee payments / salary payments)
-- ============================================================================

CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
    employee_account_id UUID REFERENCES employee_accounts(id) ON DELETE SET NULL,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'UGX',
    payout_type VARCHAR(50) NOT NULL DEFAULT 'salary' CHECK (payout_type IN ('salary', 'bonus', 'commission', 'reimbursement', 'advance', 'other')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'completed', 'failed', 'cancelled')),
    description TEXT,
    reference VARCHAR(255),
    payout_date DATE DEFAULT CURRENT_DATE,
    processed_at TIMESTAMP,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payouts_staff_id ON payouts(staff_id);
CREATE INDEX IF NOT EXISTS idx_payouts_account_id ON payouts(account_id);
CREATE INDEX IF NOT EXISTS idx_payouts_employee_account_id ON payouts(employee_account_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_payout_date ON payouts(payout_date);
CREATE INDEX IF NOT EXISTS idx_payouts_payout_type ON payouts(payout_type);

-- ============================================================================
-- SECTION 5: ENHANCE STAFF TABLE WITH ADDITIONAL HR FIELDS
-- ============================================================================

-- Add columns if they don't exist
ALTER TABLE staff ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50) DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern', 'freelance'));
ALTER TABLE staff ADD COLUMN IF NOT EXISTS join_date DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50) DEFAULT 'active' CHECK (employment_status IN ('active', 'on_leave', 'suspended', 'terminated', 'probation'));
ALTER TABLE staff ADD COLUMN IF NOT EXISTS leave_balance INT DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS next_review_date DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_review_date DATE;

CREATE INDEX IF NOT EXISTS idx_staff_employment_status ON staff(employment_status);
CREATE INDEX IF NOT EXISTS idx_staff_department_id ON staff(department_id);
CREATE INDEX IF NOT EXISTS idx_staff_role_id ON staff(role_id);
CREATE INDEX IF NOT EXISTS idx_staff_join_date ON staff(join_date);

-- ============================================================================
-- SECTION 6: OPERATIONS LOG FOR TECH STACK & PAYOUTS
-- ============================================================================

-- Link operations to systems
ALTER TABLE operations_log ADD COLUMN IF NOT EXISTS system_id UUID REFERENCES systems(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_operations_log_system_id ON operations_log(system_id);

-- ============================================================================
-- SECTION 7: UPDATE UPDATEDL_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE TRIGGER update_system_tech_profiles_updated_at
  BEFORE UPDATE ON system_tech_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_system_modules_updated_at
  BEFORE UPDATE ON system_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_employee_accounts_updated_at
  BEFORE UPDATE ON employee_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_payouts_updated_at
  BEFORE UPDATE ON payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 8: MIGRATION LOG
-- ============================================================================
INSERT INTO deployment_log (migration_name, status, migration_type, notes)
VALUES (
  '946_system_tech_complete_and_hrm_foundation.sql',
  'complete',
  'schema_enhancement',
  'Added complete tech stack profiles, system modules, employee accounts, and payouts foundation.'
);
