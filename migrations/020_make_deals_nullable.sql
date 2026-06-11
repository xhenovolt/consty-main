-- Migration: Make deals columns nullable
-- Allows flexibility in deal creation by making most columns optional
-- Only id and title are required

-- Drop the NOT NULL constraint from created_by
ALTER TABLE deals
ALTER COLUMN created_by DROP NOT NULL;

-- Make other columns nullable (if not already)
ALTER TABLE deals
ALTER COLUMN stage DROP NOT NULL;

ALTER TABLE deals
ALTER COLUMN status DROP NOT NULL;
