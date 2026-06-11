-- ============================================================
-- MIGRATION 500: Invoice System + Intelligence Modules
-- Consty Operating System
-- ============================================================

-- ============================================================
-- PART 1: INVOICE SYSTEM (Payment → Invoice Linkage)
-- ============================================================

-- Drop the old invoices table if it exists (standalone, not linked to payments)
-- We create a properly linked version
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name VARCHAR(255) NOT NULL,
    client_email VARCHAR(255),
    client_phone VARCHAR(50),
    client_address TEXT,
    system_id UUID,
    system_name VARCHAR(255),
    plan_name VARCHAR(100),
    deal_title VARCHAR(255),
    deal_total_amount DECIMAL(15,2) DEFAULT 0,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'UGX',
    total_paid_before DECIMAL(15,2) DEFAULT 0,
    total_paid_after DECIMAL(15,2) DEFAULT 0,
    remaining_balance DECIMAL(15,2) DEFAULT 0,
    payment_method VARCHAR(100),
    payment_reference VARCHAR(255),
    issued_by_user_id UUID,
    issued_by_name VARCHAR(255) DEFAULT 'Authorized Officer',
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'paid',
    file_url TEXT,
    notes TEXT,
    company_name VARCHAR(255) DEFAULT 'Consty',
    company_address TEXT DEFAULT '',
    company_phone VARCHAR(50) DEFAULT '+256 XXX XXX XXX',
    company_email VARCHAR(255) DEFAULT 'info@consty.local',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT invoice_status_check CHECK (status IN ('paid', 'pending', 'cancelled', 'draft'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_deal ON invoices(deal_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment ON invoices(payment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issued_date ON invoices(issued_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at DESC);

-- Invoice number sequence tracker
CREATE TABLE IF NOT EXISTS invoice_sequences (
    year INT NOT NULL,
    last_number INT NOT NULL DEFAULT 0,
    PRIMARY KEY (year)
);

-- ============================================================
-- PART 2: DOCUMENT CENTER
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    entity_type VARCHAR(50),
    entity_id UUID,
    file_url TEXT,
    file_name VARCHAR(255),
    file_size INT,
    mime_type VARCHAR(100),
    uploaded_by UUID,
    description TEXT,
    tags TEXT[],
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT doc_category_check CHECK (category IN ('invoice', 'contract', 'receipt', 'deal_document', 'technical', 'operational', 'financial', 'general'))
);

CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at DESC);

-- ============================================================
-- PART 3: TECHNICAL INTELLIGENCE MODULE
-- ============================================================

-- Tech stack entries for existing systems table
CREATE TABLE IF NOT EXISTS tech_stack_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL,
    language_or_framework VARCHAR(100) NOT NULL,
    version VARCHAR(50),
    role_in_system VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tech_stack_system ON tech_stack_entries(system_id);

-- Bug reports
CREATE TABLE IF NOT EXISTS bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    module_affected VARCHAR(100),
    reported_by_user UUID,
    assigned_developer UUID,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,
    time_to_resolve INTERVAL,
    CONSTRAINT bug_severity_check CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    CONSTRAINT bug_status_check CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'wont_fix'))
);

CREATE INDEX IF NOT EXISTS idx_bugs_system ON bug_reports(system_id);
CREATE INDEX IF NOT EXISTS idx_bugs_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bugs_severity ON bug_reports(severity);
CREATE INDEX IF NOT EXISTS idx_bugs_assigned ON bug_reports(assigned_developer);
CREATE INDEX IF NOT EXISTS idx_bugs_created ON bug_reports(created_at DESC);

-- Feature requests
CREATE TABLE IF NOT EXISTS feature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL,
    feature_title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    requested_by VARCHAR(255),
    assigned_developer UUID,
    status VARCHAR(30) NOT NULL DEFAULT 'proposed',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,
    CONSTRAINT feature_priority_check CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    CONSTRAINT feature_status_check CHECK (status IN ('proposed', 'approved', 'in_progress', 'completed', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_features_system ON feature_requests(system_id);
CREATE INDEX IF NOT EXISTS idx_features_status ON feature_requests(status);
CREATE INDEX IF NOT EXISTS idx_features_priority ON feature_requests(priority);

-- Developer activity log
CREATE TABLE IF NOT EXISTS developer_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id UUID NOT NULL,
    system_id UUID,
    activity_type VARCHAR(50) NOT NULL,
    notes TEXT,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP,
    time_spent INTERVAL,
    CONSTRAINT dev_activity_type_check CHECK (activity_type IN ('bug_fix', 'feature_implementation', 'investigation', 'code_review', 'deployment', 'documentation', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_dev_activity_developer ON developer_activity(developer_id);
CREATE INDEX IF NOT EXISTS idx_dev_activity_system ON developer_activity(system_id);
CREATE INDEX IF NOT EXISTS idx_dev_activity_type ON developer_activity(activity_type);

-- ============================================================
-- PART 4: FINANCIAL INTELLIGENCE MODULE
-- ============================================================

-- Capital allocation rules
CREATE TABLE IF NOT EXISTS capital_allocation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(100) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT alloc_pct_check CHECK (percentage >= 0 AND percentage <= 100),
    CONSTRAINT alloc_category_check CHECK (category IN ('operations', 'reinvestment', 'emergency_fund', 'founder_incentive', 'savings', 'marketing', 'other'))
);

-- Revenue events (every money-in event)
CREATE TABLE IF NOT EXISTS revenue_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(50) NOT NULL,
    source_id UUID,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'UGX',
    received_account UUID,
    date_received DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    allocated BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT rev_source_check CHECK (source_type IN ('deal_payment', 'subscription', 'installation_fee', 'service_fee', 'other', 'historical'))
);

CREATE INDEX IF NOT EXISTS idx_revenue_date ON revenue_events(date_received DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_source ON revenue_events(source_type);
CREATE INDEX IF NOT EXISTS idx_revenue_allocated ON revenue_events(allocated);

-- Revenue allocations (auto-calculated splits)
CREATE TABLE IF NOT EXISTS revenue_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revenue_event_id UUID REFERENCES revenue_events(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES capital_allocation_rules(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'UGX',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rev_alloc_event ON revenue_allocations(revenue_event_id);
CREATE INDEX IF NOT EXISTS idx_rev_alloc_category ON revenue_allocations(category);

-- Budget targets
CREATE TABLE IF NOT EXISTS budget_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,
    expected_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    current_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'UGX',
    period VARCHAR(20) NOT NULL DEFAULT 'monthly',
    period_start DATE,
    period_end DATE,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT budget_period_check CHECK (period IN ('monthly', 'quarterly', 'yearly'))
);

CREATE INDEX IF NOT EXISTS idx_budget_category ON budget_targets(category);
CREATE INDEX IF NOT EXISTS idx_budget_period ON budget_targets(period);

-- ============================================================
-- PART 5: ORGANIZATIONAL INTELLIGENCE MODULE (HRM)
-- ============================================================

-- Departments
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add department_id to existing roles table if not present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'department_id') THEN
        ALTER TABLE roles ADD COLUMN department_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'responsibilities') THEN
        ALTER TABLE roles ADD COLUMN responsibilities TEXT;
    END IF;
END $$;

-- Employees (linked to users table)
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_account_id UUID UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    role_id UUID,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    employment_status VARCHAR(30) NOT NULL DEFAULT 'active',
    employment_type VARCHAR(30) DEFAULT 'full_time',
    salary DECIMAL(15,2),
    salary_currency VARCHAR(10) DEFAULT 'UGX',
    hired_date DATE,
    end_date DATE,
    manager_id UUID,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT emp_status_check CHECK (employment_status IN ('active', 'on_leave', 'terminated', 'probation', 'contract')),
    CONSTRAINT emp_type_check CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern', 'freelance'))
);

CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role_id);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(employment_status);

-- Performance metrics log
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    metric_value DECIMAL(15,2) NOT NULL DEFAULT 0,
    period_start DATE,
    period_end DATE,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT perf_metric_check CHECK (metric_type IN ('deals_created', 'deals_closed', 'revenue_generated', 'prospects_added', 'operations_completed', 'bugs_fixed', 'features_delivered', 'custom'))
);

CREATE INDEX IF NOT EXISTS idx_perf_employee ON performance_metrics(employee_id);
CREATE INDEX IF NOT EXISTS idx_perf_type ON performance_metrics(metric_type);

-- ============================================================
-- PART 6: KNOWLEDGE BASE
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    author_id UUID,
    author_name VARCHAR(255),
    tags TEXT[],
    is_published BOOLEAN DEFAULT true,
    view_count INT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT kb_category_check CHECK (category IN ('technical', 'operational', 'financial', 'training', 'policy', 'general'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_articles(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_author ON knowledge_articles(author_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_published ON knowledge_articles(is_published);

-- Add columns to systems table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'systems' AND column_name = 'product_type') THEN
        ALTER TABLE systems ADD COLUMN product_type VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'systems' AND column_name = 'primary_language') THEN
        ALTER TABLE systems ADD COLUMN primary_language VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'systems' AND column_name = 'frameworks_used') THEN
        ALTER TABLE systems ADD COLUMN frameworks_used TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'systems' AND column_name = 'database_engine') THEN
        ALTER TABLE systems ADD COLUMN database_engine VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'systems' AND column_name = 'supported_platforms') THEN
        ALTER TABLE systems ADD COLUMN supported_platforms TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'systems' AND column_name = 'repository_link') THEN
        ALTER TABLE systems ADD COLUMN repository_link TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'systems' AND column_name = 'documentation_link') THEN
        ALTER TABLE systems ADD COLUMN documentation_link TEXT;
    END IF;
END $$;

-- Insert default capital allocation rules
INSERT INTO capital_allocation_rules (rule_name, percentage, category, description) VALUES
    ('Emergency Fund', 20.00, 'emergency_fund', 'Reserve for unexpected expenses'),
    ('Operations', 30.00, 'operations', 'Day-to-day operational costs'),
    ('Reinvestment', 48.00, 'reinvestment', 'Growth and development investment'),
    ('Founder Incentive', 2.00, 'founder_incentive', 'Founder compensation')
ON CONFLICT DO NOTHING;

-- Insert default departments
INSERT INTO departments (department_name, description) VALUES
    ('Engineering', 'Software development and technical operations'),
    ('Sales', 'Business development and client acquisition'),
    ('Operations', 'Daily operations and project management'),
    ('Finance', 'Financial management and accounting'),
    ('Executive', 'Company leadership and strategy')
ON CONFLICT (department_name) DO NOTHING;
