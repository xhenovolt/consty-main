-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    client_email VARCHAR(255),
    client_phone VARCHAR(20),
    client_address TEXT,
    company_name VARCHAR(255) DEFAULT 'Consty',
    company_address VARCHAR(255) DEFAULT '',
    company_service_type VARCHAR(255) DEFAULT 'Construction & Project Management',
    issue_date TIMESTAMP NOT NULL,
    due_date TIMESTAMP,
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    tax DECIMAL(15, 2) NOT NULL DEFAULT 0,
    discount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(15, 2) NOT NULL DEFAULT 0,
    balance_due DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    notes TEXT,
    currency VARCHAR(3) DEFAULT 'UGX',
    signed_by VARCHAR(255) DEFAULT 'Authorized Officer',
    signed_by_title VARCHAR(255) DEFAULT 'Project Director',
    payment_methods TEXT,
    payment_method_used VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT status_check CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled')),
    CONSTRAINT amounts_valid CHECK (subtotal >= 0 AND tax >= 0 AND discount >= 0 AND total >= 0 AND amount_paid >= 0)
);

-- Create index on invoice_number for quick lookup
CREATE INDEX idx_invoice_number ON invoices(invoice_number);

-- Create index on status for filtering
CREATE INDEX idx_invoice_status ON invoices(status);

-- Create index on client_name for filtering
CREATE INDEX idx_invoice_client ON invoices(client_name);

-- Create index on created_at for sorting
CREATE INDEX idx_invoice_created ON invoices(created_at DESC);

-- Create index on due_date for tracking overdue items
CREATE INDEX idx_invoice_due_date ON invoices(due_date);

-- Create index on user tracking (will add user_id later if needed)
CREATE INDEX idx_invoice_dates ON invoices(issue_date, due_date);
