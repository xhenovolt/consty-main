-- =============================================================================
-- MIGRATION 949: INTERNAL BANKING SYSTEM - EMPLOYEE FINANCIAL INTERACTIONS
-- =============================================================================

-- Employee loans table
CREATE TABLE IF NOT EXISTS employee_loans (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), from_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT, to_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT, amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0), currency VARCHAR(3) DEFAULT 'UGX', status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'repaid', 'defaulted', 'cancelled')), description TEXT, approved_by UUID REFERENCES users(id) ON DELETE SET NULL, approved_at TIMESTAMP, repaid_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

-- Salary advances table
CREATE TABLE IF NOT EXISTS salary_advances (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT, amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0), currency VARCHAR(3) DEFAULT 'UGX', reason VARCHAR(255) NOT NULL, status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disbursed', 'recovered')), approved_by UUID REFERENCES users(id) ON DELETE SET NULL, approved_at TIMESTAMP, disbursed_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

-- Account mutations audit log (IMMUTABLE accounts tracking)
CREATE TABLE IF NOT EXISTS account_mutations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, old_value DECIMAL(15, 2), new_value DECIMAL(15, 2) NOT NULL, reason VARCHAR(255) NOT NULL, performed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, is_superadmin_only BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

-- Staff accounts linking (staff to finance account mappings)
CREATE TABLE IF NOT EXISTS staff_accounts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), staff_id UUID NOT NULL UNIQUE REFERENCES staff(id) ON DELETE CASCADE, account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

-- Loan repayment schedule tracking
CREATE TABLE IF NOT EXISTS loan_repayments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), loan_id UUID NOT NULL REFERENCES employee_loans(id) ON DELETE CASCADE, amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0), currency VARCHAR(3) DEFAULT 'UGX', repayment_date DATE NOT NULL, status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'missed', 'partial')), recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employee_loans_from_staff_id ON employee_loans(from_staff_id);
CREATE INDEX IF NOT EXISTS idx_employee_loans_to_staff_id ON employee_loans(to_staff_id);
CREATE INDEX IF NOT EXISTS idx_employee_loans_status ON employee_loans(status);
CREATE INDEX IF NOT EXISTS idx_salary_advances_staff_id ON salary_advances(staff_id);
CREATE INDEX IF NOT EXISTS idx_salary_advances_status ON salary_advances(status);
CREATE INDEX IF NOT EXISTS idx_account_mutations_account_id ON account_mutations(account_id);
CREATE INDEX IF NOT EXISTS idx_account_mutations_performed_by ON account_mutations(performed_by);
CREATE INDEX IF NOT EXISTS idx_account_mutations_created_at ON account_mutations(created_at);
CREATE INDEX IF NOT EXISTS idx_staff_accounts_staff_id ON staff_accounts(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_accounts_account_id ON staff_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan_id ON loan_repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_repayment_date ON loan_repayments(repayment_date);
