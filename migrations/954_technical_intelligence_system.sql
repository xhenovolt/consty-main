-- =============================================================================
-- MIGRATION 954: CENTRALIZED TECHNICAL INTELLIGENCE SYSTEM
-- 
-- Transforms Consty into a self-documenting system intelligence platform
-- Eliminates dependency on markdown files for system understanding
-- Supports ALL systems (Consty, Drais, Consty, etc)
-- =============================================================================

-- ============================================================================
-- SECTION 1: SYSTEM INTELLIGENCE TABLE (Core Knowledge Base)
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  
  -- Content identification
  title VARCHAR(500) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'architecture', 'feature', 'bug_fix', 'deployment', 'decision', 
    'integration', 'performance', 'security', 'scaling', 'api', 
    'database', 'infrastructure', 'guide', 'troubleshooting', 'release_notes'
  )),
  
  -- Content storage
  content TEXT NOT NULL,
  summary VARCHAR(1000),
  tags TEXT[], -- Array of tags for searching
  
  -- Version tracking
  version_tag VARCHAR(50),
  version_number INT DEFAULT 1,
  
  -- Relationships
  related_issue_id UUID REFERENCES system_issues(id) ON DELETE SET NULL,
  related_module_id UUID REFERENCES system_modules(id) ON DELETE SET NULL,
  parent_intelligence_id UUID REFERENCES system_intelligence(id) ON DELETE SET NULL,
  
  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Search and visibility
  is_public BOOLEAN DEFAULT false,
  search_vector TSVECTOR
);

CREATE INDEX IF NOT EXISTS idx_system_intelligence_system_id ON system_intelligence(system_id);
CREATE INDEX IF NOT EXISTS idx_system_intelligence_category ON system_intelligence(category);
CREATE INDEX IF NOT EXISTS idx_system_intelligence_created_at ON system_intelligence(created_at);
CREATE INDEX IF NOT EXISTS idx_system_intelligence_tags ON system_intelligence USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_system_intelligence_search_vector ON system_intelligence USING GIN(search_vector);

-- ============================================================================
-- SECTION 2: SYSTEM ARCHITECTURE TABLE (Tech Stack Overview)
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_architecture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL UNIQUE REFERENCES systems(id) ON DELETE CASCADE,
  
  -- Tech stack (JSON for flexibility)
  tech_stack JSONB NOT NULL DEFAULT '{}',
  -- Structure: {
  --   "languages": ["JavaScript", "TypeScript"],
  --   "frameworks": [{"name": "Next.js", "version": "15.0"}],
  --   "databases": [{"type": "PostgreSQL", "version": "15.0"}],
  --   "tools": ["Docker", "Jest"],
  --   "integrations": ["Cloudinary", "Stripe"]
  -- }
  
  -- Deployment info
  platforms TEXT[],  -- web, mobile, desktop, api
  database_type VARCHAR(100),
  database_version VARCHAR(50),
  hosting_environment VARCHAR(100),  -- cloud, on-prem, hybrid
  deployment_url VARCHAR(500),
  
  -- Architecture patterns
  architecture_pattern VARCHAR(200),  -- monolith, microservices, serverless, etc
  authentication_method VARCHAR(200),
  database_architecture TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_system_architecture_system_id ON system_architecture(system_id);

-- ============================================================================
-- SECTION 3: SYSTEM VERSIONS TABLE (Release History)
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  
  -- Version information
  version_name VARCHAR(100) NOT NULL,
  version_number VARCHAR(50) NOT NULL,
  release_notes TEXT,
  changelog JSONB,  -- Structured change data
  
  -- Breaking changes
  has_breaking_changes BOOLEAN DEFAULT false,
  migration_notes TEXT,
  
  -- Release tracking
  released_at TIMESTAMP,
  released_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Deployment tracking
  deployed_to_production BOOLEAN DEFAULT false,
  deployment_date TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_versions_system_id ON system_versions(system_id);
CREATE INDEX IF NOT EXISTS idx_system_versions_released_at ON system_versions(released_at);
CREATE INDEX IF NOT EXISTS idx_system_versions_version_number ON system_versions(version_number);

-- ============================================================================
-- SECTION 4: ENHANCEMENT: ADD COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add intelligence metadata to systems table
ALTER TABLE systems ADD COLUMN IF NOT EXISTS has_intelligence BOOLEAN DEFAULT false;
ALTER TABLE systems ADD COLUMN IF NOT EXISTS intelligence_score INT DEFAULT 0; -- 0-100 completeness score
ALTER TABLE systems ADD COLUMN IF NOT EXISTS last_intelligence_update TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_systems_has_intelligence ON systems(has_intelligence);
CREATE INDEX IF NOT EXISTS idx_systems_intelligence_score ON systems(intelligence_score);

-- =============================================================================
-- SECTION 5: SEARCH VECTORS FOR FULL-TEXT SEARCH
-- =============================================================================

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_system_intelligence_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '') || ' ' || COALESCE(array_to_string(NEW.tags, ' '), ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on insert/update
CREATE TRIGGER trigger_system_intelligence_search_vector
BEFORE INSERT OR UPDATE ON system_intelligence
FOR EACH ROW
EXECUTE FUNCTION update_system_intelligence_search_vector();

-- =============================================================================
-- SECTION 6: AUDIT LOGGING FOR INTELLIGENCE CHANGES
-- =============================================================================

ALTER TABLE operations_log ADD COLUMN IF NOT EXISTS intelligence_id UUID REFERENCES system_intelligence(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_operations_log_intelligence_id ON operations_log(intelligence_id);

-- =============================================================================
-- SECTION 7: DEVELOPER MODE & INTERNAL NOTES
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_intelligence_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intelligence_id UUID NOT NULL REFERENCES system_intelligence(id) ON DELETE CASCADE,
  
  -- Internal note data
  content TEXT NOT NULL,
  note_type VARCHAR(50) CHECK (note_type IN ('warning', 'insight', 'todo', 'decision', 'technical_debt')),
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  
  -- Access control
  visible_to_role VARCHAR(50) DEFAULT 'developer',
  
  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_intelligence_internal_notes_intelligence_id ON system_intelligence_internal_notes(intelligence_id);

-- =============================================================================
-- SECTION 8: MARKDOWN INGESTION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS markdown_ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  
  -- Job tracking
  job_status VARCHAR(50) DEFAULT 'pending' CHECK (job_status IN ('pending', 'running', 'completed', 'failed')),
  file_path VARCHAR(500) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  
  -- Ingestion details
  content TEXT,
  category_assigned VARCHAR(50),
  intelligence_id UUID REFERENCES system_intelligence(id) ON DELETE SET NULL,
  
  -- Results
  error_message TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Deduplication
  content_hash VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_markdown_ingestion_jobs_system_id ON markdown_ingestion_jobs(system_id);
CREATE INDEX IF NOT EXISTS idx_markdown_ingestion_jobs_job_status ON markdown_ingestion_jobs(job_status);
CREATE INDEX IF NOT EXISTS idx_markdown_ingestion_jobs_created_at ON markdown_ingestion_jobs(created_at);

-- =============================================================================
-- FINAL: Completion marker
-- =============================================================================

-- Log completion
INSERT INTO system_logs (log_type, message, metadata)
VALUES ('migration', 'Migration 954: Technical Intelligence System created', 
  jsonb_build_object('tables_created', ARRAY['system_intelligence', 'system_architecture', 'system_versions', 'system_intelligence_internal_notes', 'markdown_ingestion_jobs']));
