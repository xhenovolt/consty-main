-- ============================================================================
-- ISSUE INTELLIGENCE TABLES
-- Creates bug_reports, issue_root_causes, and issue_resolutions tables
-- Prerequisite: users table must exist
-- ============================================================================

-- Bug Reports table (no FK to systems — system_id is informational only)
CREATE TABLE IF NOT EXISTS bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    module_affected VARCHAR(100),
    reported_by_user UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_developer UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    time_to_resolve INTERVAL,
    CONSTRAINT bug_severity_check CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    CONSTRAINT bug_status_check CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'wont_fix'))
);

CREATE INDEX IF NOT EXISTS idx_bugs_system ON bug_reports(system_id);
CREATE INDEX IF NOT EXISTS idx_bugs_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bugs_severity ON bug_reports(severity);
CREATE INDEX IF NOT EXISTS idx_bugs_assigned ON bug_reports(assigned_developer);

-- Root Cause Analysis table
CREATE TABLE IF NOT EXISTS issue_root_causes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bug_report_id UUID REFERENCES bug_reports(id) ON DELETE CASCADE,
    root_cause TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'unknown',
    identified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    identified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    prevention_strategy TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT irc_category_check CHECK (category IN (
        'code_bug', 'design_flaw', 'missing_validation', 'integration',
        'performance', 'security', 'configuration', 'data_issue',
        'third_party', 'infrastructure', 'unknown'
    ))
);

CREATE INDEX IF NOT EXISTS idx_root_causes_bug ON issue_root_causes(bug_report_id);
CREATE INDEX IF NOT EXISTS idx_root_causes_category ON issue_root_causes(category);

-- Issue Resolutions table
CREATE TABLE IF NOT EXISTS issue_resolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bug_report_id UUID REFERENCES bug_reports(id) ON DELETE CASCADE,
    resolution_type VARCHAR(50) NOT NULL DEFAULT 'fix',
    description TEXT NOT NULL,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    time_to_resolve_hours NUMERIC(10, 2),
    files_changed TEXT[],
    verification_steps TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ir_type_check CHECK (resolution_type IN ('fix', 'workaround', 'wont_fix', 'duplicate', 'by_design', 'config_change'))
);

CREATE INDEX IF NOT EXISTS idx_resolutions_bug ON issue_resolutions(bug_report_id);
CREATE INDEX IF NOT EXISTS idx_resolutions_type ON issue_resolutions(resolution_type);
