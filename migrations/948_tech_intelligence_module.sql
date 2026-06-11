-- =============================================================================
-- MIGRATION 948: TECH INTELLIGENCE MODULE - REUSABLE TECH STACKS
-- =============================================================================

-- Create tech stacks table (centralized tech knowledge)
CREATE TABLE IF NOT EXISTS tech_stacks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL UNIQUE, description TEXT, created_by UUID REFERENCES users(id) ON DELETE SET NULL, updated_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

-- Create tech stack items (components of a stack)
CREATE TABLE IF NOT EXISTS tech_stack_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tech_stack_id UUID NOT NULL REFERENCES tech_stacks(id) ON DELETE CASCADE, type VARCHAR(50) NOT NULL CHECK (type IN ('language', 'framework', 'database', 'tool', 'infra', 'cdn', 'monitoring', 'other')), name VARCHAR(255) NOT NULL, version VARCHAR(50), notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

-- Create encrypted credentials storage for tech stacks
CREATE TABLE IF NOT EXISTS tech_stack_credentials (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tech_stack_id UUID NOT NULL REFERENCES tech_stacks(id) ON DELETE CASCADE, key_name VARCHAR(255) NOT NULL, value_encrypted TEXT NOT NULL, description TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

-- Modify systems table to reference tech stacks
ALTER TABLE systems ADD COLUMN IF NOT EXISTS tech_stack_id UUID REFERENCES tech_stacks(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tech_stacks_name ON tech_stacks(name);
CREATE INDEX IF NOT EXISTS idx_tech_stacks_created_by ON tech_stacks(created_by);
CREATE INDEX IF NOT EXISTS idx_tech_stack_items_tech_stack_id ON tech_stack_items(tech_stack_id);
CREATE INDEX IF NOT EXISTS idx_tech_stack_items_type ON tech_stack_items(type);
CREATE INDEX IF NOT EXISTS idx_tech_stack_credentials_tech_stack_id ON tech_stack_credentials(tech_stack_id);
CREATE INDEX IF NOT EXISTS idx_systems_tech_stack_id ON systems(tech_stack_id);
