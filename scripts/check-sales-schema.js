#!/usr/bin/env node

/**
 * Check sales table schema
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: '.env.local' });

async function checkSchema() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  
  try {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'sales'
        ORDER BY ordinal_position;
      `);
      
      console.log('\n✅ Sales Table Columns:');
      console.log('━'.repeat(80));
      
      result.rows.forEach(row => {
        const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(`  ${row.column_name.padEnd(25)} ${row.data_type.padEnd(20)} ${nullable}`);
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkSchema();
