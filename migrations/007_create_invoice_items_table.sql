-- Create invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15, 2) NOT NULL,
    total_price DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_invoice_items_invoices FOREIGN KEY (invoice_id) 
        REFERENCES invoices(id) ON DELETE CASCADE,
    CONSTRAINT quantity_check CHECK (quantity > 0),
    CONSTRAINT price_check CHECK (unit_price >= 0 AND total_price >= 0)
);

-- Create index on invoice_id for quick lookup of items by invoice
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Create index on created_at for sorting
CREATE INDEX idx_invoice_items_created ON invoice_items(created_at);

-- Create index for deletion efficiency
CREATE INDEX idx_invoice_items_updated ON invoice_items(updated_at);
