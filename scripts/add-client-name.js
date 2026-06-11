#!/usr/bin/env node

/**
 * Add client_name column to deals table
 * Run with: node scripts/add-client-name.js
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

const { Pool } = pg;

async function addClientName() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('🚀 Adding client_name column to deals table...\n');
    const client = await pool.connect();

    try {
      // Add the client_name column
      console.log('📝 Adding client_name column...');
      await client.query(`
        ALTER TABLE deals 
        ADD COLUMN IF NOT EXISTS client_name TEXT;
      `);
      console.log('✅ client_name column added\n');

      // Create index for queries
      console.log('📝 Creating index for client_name...');
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_deals_client_name 
        ON deals(client_name) 
        WHERE deleted_at IS NULL;
      `);
      console.log('✅ Index created\n');

      console.log('✨ Migration completed successfully!');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addClientName();
