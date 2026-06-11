/**
 * Migration 019: Add missing columns to share_issuances table
 * 
 * The share_issuances table was missing several columns needed for the
 * equity issuance workflow, including:
 * - issued_at_price: Price per share at time of issuance
 * - recipient_id, recipient_type: Who received the shares
 * - issuance_reason, issuance_type: Why and how shares were issued
 * - approval_status: Track approval workflow
 * - created_by_id, approved_by_id: Track who created/approved
 * - And other tracking columns
 */

-- Add missing columns to share_issuances table
ALTER TABLE share_issuances
ADD COLUMN IF NOT EXISTS issued_at_price NUMERIC(19,4),
ADD COLUMN IF NOT EXISTS recipient_id UUID,
ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(50) DEFAULT 'individual',
ADD COLUMN IF NOT EXISTS issuance_reason VARCHAR(255),
ADD COLUMN IF NOT EXISTS issuance_type VARCHAR(50) DEFAULT 'grant',
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS confirmation_received BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS previous_issued_shares BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS ownership_dilution_impact NUMERIC(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by_id UUID,
ADD COLUMN IF NOT EXISTS approved_by_id UUID,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS issued_at TIMESTAMP;

-- Update existing records to use reasonable defaults
UPDATE share_issuances
SET issued_at_price = COALESCE(price_per_share, 0)
WHERE issued_at_price IS NULL;

UPDATE share_issuances
SET issued_at = issuance_date
WHERE issued_at IS NULL;

UPDATE share_issuances
SET approval_status = status
WHERE approval_status IS NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_share_issuances_approval_status ON share_issuances(approval_status);
CREATE INDEX IF NOT EXISTS idx_share_issuances_created_by ON share_issuances(created_by_id);
CREATE INDEX IF NOT EXISTS idx_share_issuances_approved_by ON share_issuances(approved_by_id);
CREATE INDEX IF NOT EXISTS idx_share_issuances_recipient ON share_issuances(recipient_id);

-- Add comments to document the columns
COMMENT ON COLUMN share_issuances.issued_at_price IS 'Price per share at the time of issuance';
COMMENT ON COLUMN share_issuances.recipient_id IS 'ID of the user who received the shares';
COMMENT ON COLUMN share_issuances.recipient_type IS 'Type of recipient (individual, company, trust, etc)';
COMMENT ON COLUMN share_issuances.issuance_reason IS 'Reason for the issuance (grant, purchase, founders, etc)';
COMMENT ON COLUMN share_issuances.issuance_type IS 'Type of issuance (grant, sale, exercise, etc)';
COMMENT ON COLUMN share_issuances.approval_status IS 'Approval workflow status (pending, approved, issued, rejected)';
COMMENT ON COLUMN share_issuances.created_by_id IS 'ID of the user who proposed the issuance';
COMMENT ON COLUMN share_issuances.approved_by_id IS 'ID of the user who approved the issuance';
COMMENT ON COLUMN share_issuances.issued_at IS 'Timestamp when shares were actually issued';
