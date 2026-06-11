#!/usr/bin/env node

/**
 * Check all tables for NOT NULL created_by columns
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: '.env.local' });

async function checkTables() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  
  try {
    const client = await pool.connect();
    
    try {
      // Get all tables
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `);
      
      console.log('\n📊 Tables with created_by columns:');
      console.log('━'.repeat(80));
      
      for (const row of tablesResult.rows) {
        const tableName = row.table_name;
        
        const columnsResult = await client.query(`
          SELECT column_name, is_nullable, data_type
          FROM information_schema.columns
          WHERE table_name = $1
          AND column_name IN ('created_by', 'created_by_id')
          ORDER BY ordinal_position;
        `, [tableName]);
        
        if (columnsResult.rows.length > 0) {
          const col = columnsResult.rows[0];
          const nullable = col.is_nullable === 'YES' ? '✅ NULL' : '❌ NOT NULL';
          console.log(`  ${tableName.padEnd(30)} ${col.column_name.padEnd(15)} ${nullable}`);
        }
      }
      
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

checkTables();
