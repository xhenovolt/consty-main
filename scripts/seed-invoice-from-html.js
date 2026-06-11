#!/usr/bin/env node

/**
 * Seed the specific invoice from invoicegen.html
 * Run with: node scripts/seed-invoice-from-html.js
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config({ path: '.env.local' });

async function seedInvoiceFromHTML() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🌱 Seeding the Excel Islamic Nursery invoice from HTML...\n');

    // Check if invoice already exists
    const existing = await pool.query(
      'SELECT id FROM invoices WHERE invoice_number = $1',
      ['CST/INV/001']
    );

    let invoiceId;

    if (existing.rows.length > 0) {
      invoiceId = existing.rows[0].id;
      console.log('📝 Invoice CST/INV/001 already exists, updating items...\n');
      
      // Delete old items
      await pool.query('DELETE FROM invoice_items WHERE invoice_id = $1', [invoiceId]);
    } else {
      // Insert the main invoice from HTML
      console.log('📝 Inserting invoice from invoicegen.html...\n');
      
      const result = await pool.query(`
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
            payment_method_used
        ) VALUES (
            'CST/INV/001',
            'Site Mobilization & Progress Invoice',
            'Excel Construction Ltd',
            'admin@excelshoool.ug',
            '+256 701 234 567',
            'Busembatia, Namutumba District, Uganda',
            'Consty',
            'Site Office, Kampala, Uganda',
            'Construction & Project Management',
            TO_TIMESTAMP('24-12-2025 00:00:00', 'DD-MM-YYYY HH24:MI:SS'),
            TO_TIMESTAMP('31-12-2025 00:00:00', 'DD-MM-YYYY HH24:MI:SS'),
            2950000.00,
            0.00,
            0.00,
            2950000.00,
            500000.00,
            2450000.00,
            'partially_paid',
            'This invoice covers project mobilization, temporary works, and early-stage site setup. Balance payable as per agreed milestones.',
            'UGX',
            'Authorized Officer',
            'Project Director',
            '["Bank Transfer", "Mobile Money (MTN, Airtel)", "Cash"]',
            'Mobile Money'
        )
        RETURNING id
      `);
      
      invoiceId = result.rows[0].id;
    }

    // Insert line items
    console.log('📋 Inserting line items...\n');

    await pool.query(`
      INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
      VALUES 
        ($1, 'Site Mobilization & Survey Setup', 1, 2500000.00, 2500000.00),
        ($1, 'Project Signage and Temporary Works', 1, 450000.00, 450000.00)
    `, [invoiceId]);

    console.log('✅ Successfully seeded invoice CST/INV/001\n');
    console.log('📊 Invoice Details:');
    console.log('   Invoice No: CST/INV/001');
    console.log('   Client: Excel Construction Ltd');
    console.log('   Issue Date: 24th December, 2025');
    console.log('   Total Amount: UGX 2,950,000');
    console.log('   Amount Paid: UGX 500,000');
    console.log('   Balance Due: UGX 2,450,000');
    console.log('   Status: PARTIALLY PAID');
    console.log('\n🚀 View at: http://localhost:3000/invoices/[id]/view\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedInvoiceFromHTML();
