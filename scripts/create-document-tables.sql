-- Database Schema Extensions for Document Management Module
-- Phase 1: Create missing tables and extend existing ones

-- Create document_branding table
CREATE TABLE IF NOT EXISTS document_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_name TEXT NOT NULL,
    header_text TEXT,
    primary_color TEXT NOT NULL DEFAULT '#1F2937',
    secondary_color TEXT NOT NULL DEFAULT '#374151',
    accent_color TEXT NOT NULL DEFAULT '#3B82F6',
    logo_url TEXT,
    logo_width INTEGER DEFAULT 100,
    logo_height INTEGER DEFAULT 60,
    signature_url TEXT,
    signature_name TEXT,
    signature_title TEXT,
    address_line1 TEXT,
    city TEXT,
    postal_code TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create document_categories table
CREATE TABLE IF NOT EXISTS document_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create generated_documents table
CREATE TABLE IF NOT EXISTS generated_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES document_templates(id),
    branding_id UUID REFERENCES document_branding(id),
    unique_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    document_type TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_email TEXT,
    recipient_phone TEXT,
    placeholder_data JSONB NOT NULL DEFAULT '{}',
    verification_token TEXT NOT NULL,
    verification_hash TEXT NOT NULL,
    html_content TEXT,
    pdf_url TEXT,
    category_id UUID REFERENCES document_categories(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    viewed_count INTEGER NOT NULL DEFAULT 0,
    last_viewed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    generated_by UUID,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create generated_document_logs table
CREATE TABLE IF NOT EXISTS generated_document_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generated_document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,
    level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error')),
    phase TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    actor_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create document_audit_logs table
CREATE TABLE IF NOT EXISTS document_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('generated', 'viewed', 'downloaded', 'revoked', 'restored', 'updated')),
    actor_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create document_verification_logs table
CREATE TABLE IF NOT EXISTS document_verification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    user_agent TEXT,
    verification_status TEXT NOT NULL DEFAULT 'success' CHECK (verification_status IN ('success', 'failed', 'tampered')),
    verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Foreign key for category_id is already in CREATE TABLE

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_generated_documents_unique_id ON generated_documents(unique_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_recipient_email ON generated_documents(recipient_email);
CREATE INDEX IF NOT EXISTS idx_generated_documents_status ON generated_documents(status);
CREATE INDEX IF NOT EXISTS idx_generated_documents_expires_at ON generated_documents(expires_at);
CREATE INDEX IF NOT EXISTS idx_generated_documents_category_id ON generated_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_generated_document_logs_document_id ON generated_document_logs(generated_document_id);
CREATE INDEX IF NOT EXISTS idx_document_audit_logs_document_id ON document_audit_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_document_audit_logs_action ON document_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_document_verification_logs_document_id ON document_verification_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_category ON document_templates(category);

-- Insert default branding
INSERT INTO document_branding (
    organization_name,
    header_text,
    primary_color,
    secondary_color,
    accent_color,
    phone,
    email,
    website
) VALUES (
    'CONSTY Technologies',
    'Enterprise Document Management System',
    '#1F2937',
    '#374151',
    '#3B82F6',
    '+1 (555) 123-4567',
    'documents@consty.local',
    'https://consty.example.com'
) ON CONFLICT DO NOTHING;

-- Insert default categories
INSERT INTO document_categories (name, description) VALUES
    ('internship', 'Internship-related documents'),
    ('employment', 'Employment and HR documents'),
    ('acknowledgement', 'Application acknowledgements'),
    ('certificates', 'Completion and achievement certificates'),
    ('memos', 'Internal memos and communications')
ON CONFLICT (name) DO NOTHING;
