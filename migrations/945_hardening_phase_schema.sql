-- =============================================================================
-- MIGRATION 945: HARDENING PHASE - CORE SCHEMA ENHANCEMENTS
-- 
-- Adds critical tables and columns for system stabilization:
-- - system_tech_stack: Track tech stack per system
-- - salary_accounts: Link staff salary to financial accounts  
-- - Multi-currency support: Add currency fields to payments
-- - Account status management
-- - Session invalidation support
-- - Presence tracking (last_seen_at)
-- - Operations log enhancements
-- =============================================================================

-- ============================================================================
-- SECTION 1: TECH STACK TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_tech_stack (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
    language VARCHAR(100),
    framework VARCHAR(100),
    database VARCHAR(100),
    platform VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_tech_stack_system_id ON system_tech_stack(system_id);

-- ============================================================================
-- SECTION 2: SALARY ACCOUNTS LINKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS salary_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    salary_amount DECIMAL(15, 2) NOT NULL,
    frequency VARCHAR(50) DEFAULT 'monthly',
    currency VARCHAR(3) DEFAULT 'UGX',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(staff_id)
);

CREATE INDEX IF NOT EXISTS idx_salary_accounts_staff_id ON salary_accounts(staff_id);
CREATE INDEX IF NOT EXISTS idx_salary_accounts_account_id ON salary_accounts(account_id);

-- ============================================================================
-- SECTION 3: MULTI-CURRENCY SUPPORT IN PAYMENTS
-- ============================================================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'UGX';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(15, 6) DEFAULT 1.0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_ugx DECIMAL(15, 2);

-- Backfill amount_ugx from existing amounts
UPDATE payments SET amount_ugx = amount WHERE amount_ugx IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_currency ON payments(currency);

-- ============================================================================
-- SECTION 4: ACCOUNT STATUS MANAGEMENT
-- ============================================================================
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
UPDATE accounts SET status = 'active' WHERE status IS NULL;

-- Add constraint to ensure valid statuses
ALTER TABLE accounts ADD CONSTRAINT check_account_status_valid 
  CHECK (status IN ('active', 'suspended', 'closed', 'pending'));

-- ============================================================================
-- SECTION 5: SESSION INVALIDATION SUPPORT
-- ============================================================================
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMP;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS invalidation_reason VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_sessions_invalidated_at ON sessions(invalidated_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id_active ON sessions(user_id) 
  WHERE invalidated_at IS NULL;

-- ============================================================================
-- SECTION 6: PRESENCE TRACKING WITH LAST_SEEN_AT
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS online_status VARCHAR(20) DEFAULT 'offline';

CREATE INDEX IF NOT EXISTS idx_users_last_seen_at ON users(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_users_online_status ON users(online_status);

-- ============================================================================
-- SECTION 7: OPERATIONS LOG ENHANCEMENTS
-- ============================================================================
ALTER TABLE operations_log ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE operations_log ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'success';

UPDATE operations_log SET description = 'Operation completed' 
  WHERE description IS NULL OR description = '';

ALTER TABLE operations_log 
  ALTER COLUMN description SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operations_log_status ON operations_log(status);
CREATE INDEX IF NOT EXISTS idx_operations_log_created_at ON operations_log(created_at);

-- ============================================================================
-- SECTION 8: ISSUES INTELLIGENCE EXPANSION
-- ============================================================================
CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(50) NOT NULL,
    system_id UUID REFERENCES systems(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_time_seconds INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (resolved_at - created_at))::INTEGER
    ) STORED,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_issue_severity CHECK (severity IN ('low', 'medium', 'critical')),
    CONSTRAINT check_issue_status CHECK (status IN ('open', 'in-progress', 'resolved', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_issues_system_id ON issues(system_id);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);

-- ============================================================================
-- SECTION 9: FOLLOW-UPS CENTRALIZATION
-- ============================================================================
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

UPDATE follow_ups SET status = 'pending' WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_follow_ups_prospect_id ON follow_ups(prospect_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_user_id ON follow_ups(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);

-- ============================================================================
-- SECTION 10: ACCOUNT MANAGEMENT ENHANCEMENTS
-- ============================================================================
-- account_status field already used in migration 944, creating alias
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR(100);

-- ============================================================================
-- SECTION 11: LICENSE SYSTEM VALIDATION
-- ============================================================================
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS validation_errors JSONB;

CREATE INDEX IF NOT EXISTS idx_licenses_validation_status ON licenses(validation_status);

-- ============================================================================
-- SECTION 12: DEPARTMENT MANAGEMENT ENHANCEMENTS
-- ============================================================================
ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT false;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS dependency_count INTEGER DEFAULT 0;

-- ============================================================================
-- FINAL: SUMMARY
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 945 applied: Hardening phase core schema enhancements complete';
  RAISE NOTICE 'Added tables: system_tech_stack, salary_accounts, issues';
  RAISE NOTICE 'Enhanced: payments, sessions, users, operations_log, follow_ups, licenses, departments';
END $$;
