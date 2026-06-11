#!/usr/bin/env node
/**
 * Database Schema Inspector
 * Checks what tables and columns exist in the database
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function inspect() {
  const client = await pool.connect();
  
  try {
    // Get all tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' 
      ORDER BY table_name
    `);
    
    console.log('=== PUBLIC TABLES ===');
    for (const row of tables.rows) {
      console.log(row.table_name);
    }
    
    // Check if key Consty tables exist
    console.log('\n=== CONSTY CORE TABLES CHECK ===');
    const coreTables = [
      'users', 'prospects', 'prospect_activities', 'prospect_stages', 'prospect_sources',
      'clients', 'deals', 'contracts', 'payments', 'allocations', 'expenses',
      'expense_categories', 'intellectual_property', 'invoices', 'invoice_items',
      'sales', 'assets', 'liabilities', 'infrastructure', 'staff'
    ];
    
    for (const table of coreTables) {
      const exists = tables.rows.some(r => r.table_name === table);
      console.log(`${exists ? '✅' : '❌'} ${table}`);
    }
    
    // Check users table columns
    console.log('\n=== USERS COLUMNS ===');
    const userCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    for (const col of userCols.rows) {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    }
    
    // If intellectual_property exists, check its columns
    const ipExists = tables.rows.some(r => r.table_name === 'intellectual_property');
    if (ipExists) {
      console.log('\n=== INTELLECTUAL_PROPERTY COLUMNS ===');
      const ipCols = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'intellectual_property'
        ORDER BY ordinal_position
      `);
      for (const col of ipCols.rows) {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      }
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

inspect().catch(e => {
  console.error(e);
  process.exit(1);
});
