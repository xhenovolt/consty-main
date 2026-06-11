-- Migration: Add routes and dependencies to system_modules for full module registry

ALTER TABLE system_modules 
ADD COLUMN IF NOT EXISTS routes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS dependencies JSONB DEFAULT '[]'::jsonb;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_system_modules_module_name ON system_modules(module_name);

-- Create unique constraint on (system_id, module_name) to prevent duplicates
-- First, delete any duplicates if they exist
DELETE FROM system_modules m1
WHERE m1.id NOT IN (
  SELECT DISTINCT ON (m2.system_id, m2.module_name) m2.id
  FROM system_modules m2
  ORDER BY m2.system_id, m2.module_name, m2.created_at DESC
);

-- Now add the constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'system_modules' AND constraint_name = 'uq_system_modules_name'
  ) THEN
    ALTER TABLE system_modules
    ADD CONSTRAINT uq_system_modules_name UNIQUE (system_id, module_name);
  END IF;
END $$;
