-- Seed script for initial invoice data
-- Run this in Neon console or via psql

-- First, ensure tables exist (from migrations)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    client_email VARCHAR(255),
    client_phone VARCHAR(20),
    client_address TEXT,
    company_name VARCHAR(255) DEFAULT 'Consty',
    company_address VARCHAR(255) DEFAULT 'Site Office, Kampala, Uganda',
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

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    total_price DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT quantity_positive CHECK (quantity > 0),
    CONSTRAINT price_non_negative CHECK (unit_price >= 0 AND total_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_invoice_items ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_created ON invoice_items(created_at);

-- Now insert sample data
-- Delete existing sample data first (optional)
DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number LIKE 'CST/INV/%');
DELETE FROM invoices WHERE invoice_number LIKE 'CST/INV/%';

-- Insert first sample invoice (PAID)
INSERT INTO invoices (
    invoice_number,
    invoice_name,
    client_name,
    client_email,
    client_phone,
    client_address,
    company_name,
    company_address,
    company_service_type,
    issue_date,
    due_date,
    subtotal,
    tax,
    discount,
    total,
    amount_paid,
    balance_due,
    status,
    notes,
    currency,
    signed_by,
    signed_by_title,
    payment_methods,
    payment_method_used,
    created_at,
    updated_at
) VALUES (
    'CST/INV/2602/001',
    'Software Development Invoice',
    'Tech Innovations Ltd',
    'accounts@techinnovations.ug',
    '+256 701 234 567',
    'Plot 15, Kampala Road, Kampala, Uganda',
    'Consty',
    'Site Office, Kampala, Uganda',
    'Construction & Project Management',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '3 days',
    5000000.00,
    500000.00,
    0.00,
    5500000.00,
    5500000.00,
    0.00,
    'paid',
    'Mobile app development complete. Deployment to production completed.',
    'UGX',
    'Authorized Officer',
    'Project Director',
    '["Bank Transfer", "Mobile Money", "Cheque"]',
    'Bank Transfer',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '1 days'
) RETURNING id AS invoice_1_id;

-- Insert items for first invoice
INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price, created_at, updated_at)
SELECT id, 'Mobile App Development - iOS & Android', 1, 4500000.00, 4500000.00, NOW() - INTERVAL '25 days', NOW() FROM invoices WHERE invoice_number = 'CST/INV/2602/001'
UNION ALL
SELECT id, 'API Integration & Backend Setup', 1, 500000.00, 500000.00, NOW() - INTERVAL '25 days', NOW() FROM invoices WHERE invoice_number = 'CST/INV/2602/001';

-- Insert second sample invoice (SENT)
INSERT INTO invoices (
    invoice_number,
    invoice_name,
    client_name,
    client_email,
    client_phone,
    client_address,
    company_name,
    company_address,
    company_service_type,
    issue_date,
    due_date,
    subtotal,
    tax,
    discount,
    total,
    amount_paid,
    balance_due,
    status,
    notes,
    currency,
    signed_by,
    signed_by_title,
    payment_methods,
    payment_method_used,
    created_at,
    updated_at
) VALUES (
    'CST/INV/2602/002',
    'Web Development Invoice',
    'Global Solutions Inc',
    'billing@globalsolutions.com',
    '+256 702 345 678',
    '2847 Broadway, New York, NY 10025, USA',
    'Consty',
    'Site Office, Kampala, Uganda',
    'Construction & Project Management',
    NOW() - INTERVAL '5 days',
    NOW() + INTERVAL '10 days',
    3000000.00,
    300000.00,
    0.00,
    3300000.00,
    0.00,
    3300000.00,
    'sent',
    'Website redesign and e-commerce integration. Awaiting payment.',
    'UGX',
    'Authorized Officer',
    'Project Director',
    '["Bank Transfer", "Cryptocurrency", "PayPal"]',
    NULL,
    NOW() - INTERVAL '5 days',
    NOW()
) RETURNING id AS invoice_2_id;

-- Insert items for second invoice
INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price, created_at, updated_at)
SELECT id, 'Website Design & Development', 1, 2000000.00, 2000000.00, NOW() - INTERVAL '5 days', NOW() FROM invoices WHERE invoice_number = 'CST/INV/2602/002'
UNION ALL
SELECT id, 'E-Commerce Integration', 1, 1000000.00, 1000000.00, NOW() - INTERVAL '5 days', NOW() FROM invoices WHERE invoice_number = 'CST/INV/2602/002';

-- Insert third sample invoice (PARTIALLY PAID)
INSERT INTO invoices (
    invoice_number,
    invoice_name,
    client_name,
    client_email,
    client_phone,
    client_address,
    company_name,
    company_address,
    company_service_type,
    issue_date,
    due_date,
    subtotal,
    tax,
    discount,
    total,
    amount_paid,
    balance_due,
    status,
    notes,
    currency,
    signed_by,
    signed_by_title,
    payment_methods,
    payment_method_used,
    created_at,
    updated_at
) VALUES (
    'CST/INV/2602/003',
    'Consulting Services Invoice',
    'Enterprise Systems Ltd',
    'finance@enterprisesystems.ug',
    '+256 703 456 789',
    'Innovation Hub, Nakasero, Kampala',
    'Consty',
    'Site Office, Kampala, Uganda',
    'Construction & Project Management',
    NOW() - INTERVAL '15 days',
    NOW(),
    2500000.00,
    250000.00,
    100000.00,
    2650000.00,
    1500000.00,
    1150000.00,
    'partially_paid',
    'System architecture consulting and technology strategy. Partial payment received.',
    'UGX',
    'Authorized Officer',
    'Project Director',
    '["Bank Transfer", "Mobile Money"]',
    'Mobile Money',
    NOW() - INTERVAL '15 days',
    NOW()
) RETURNING id AS invoice_3_id;

-- Insert items for third invoice
INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price, created_at, updated_at)
SELECT id, 'System Architecture Consulting (40 hours)', 40, 25000.00, 1000000.00, NOW() - INTERVAL '15 days', NOW() FROM invoices WHERE invoice_number = 'CST/INV/2602/003'
UNION ALL
SELECT id, 'Technology Strategy Workshop', 3, 500000.00, 1500000.00, NOW() - INTERVAL '15 days', NOW() FROM invoices WHERE invoice_number = 'CST/INV/2602/003';

-- Insert fourth sample invoice (DRAFT)
INSERT INTO invoices (
    invoice_number,
    invoice_name,
    client_name,
    client_email,
    client_phone,
    client_address,
    company_name,
    company_address,
    company_service_type,
    issue_date,
    due_date,
    subtotal,
    tax,
    discount,
    total,
    amount_paid,
    balance_due,
    status,
    notes,
    currency,
    signed_by,
    signed_by_title,
    payment_methods,
    payment_method_used,
    created_at,
    updated_at
) VALUES (
    'CST/INV/2602/004',
    'UI/UX Design Invoice',
    'Creative Design Studio',
    'contact@creativedesign.ug',
    '+256 704 567 890',
    '5 Oasis Court, Kololo, Kampala',
    'Consty',
    'Site Office, Kampala, Uganda',
    'Construction & Project Management',
    NOW(),
    NOW() + INTERVAL '30 days',
    1200000.00,
    120000.00,
    50000.00,
    1270000.00,
    0.00,
    1270000.00,
    'draft',
    'Complete UI/UX redesign. Draft for approval. Ready to send.',
    'UGX',
    'Authorized Officer',
    'Project Director',
    '["Bank Transfer", "Mobile Money"]',
    NULL,
    NOW(),
    NOW()
) RETURNING id AS invoice_4_id;

-- Insert items for fourth invoice
INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price, created_at, updated_at)
SELECT id, 'UI Design - 50 screens', 50, 15000.00, 750000.00, NOW(), NOW() FROM invoices WHERE invoice_number = 'CST/INV/2602/004'
UNION ALL
SELECT id, 'UX Research & Testing', 1, 450000.00, 450000.00, NOW(), NOW() FROM invoices WHERE invoice_number = 'CST/INV/2602/004';

-- Verify data was inserted
SELECT 
    'Invoices Created' AS status,
    COUNT(*) as count,
    SUM(total) as total_amount
FROM invoices;

SELECT 
    'Line Items Created' AS status,
    COUNT(*) as count
FROM invoice_items;
