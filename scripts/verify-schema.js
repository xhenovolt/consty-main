#!/usr/bin/env node

/**
 * Database Schema Verification
 * Checks if the deals table has the required columns
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function verifySchema() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  
  try {
    const client = await pool.connect();
    
    try {
      // Get table columns
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'deals'
        ORDER BY ordinal_position;
      `);
      
      console.log('\n✅ Deals Table Columns:');
      console.log('━'.repeat(60));
      
      result.rows.forEach(row => {
        const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(`  ${row.column_name.padEnd(25)} ${row.data_type.padEnd(20)} ${nullable}`);
      });
      
      // Check for specific columns
      const columns = result.rows.map(r => r.column_name);
      const requiredColumns = ['description', 'assigned_to'];
      
      console.log('\n📋 Required Columns Check:');
      console.log('━'.repeat(60));
      requiredColumns.forEach(col => {
        if (columns.includes(col)) {
          console.log(`  ✅ ${col}`);
        } else {
          console.log(`  ❌ ${col} - MISSING`);
        }
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifySchema();
