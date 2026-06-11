#!/usr/bin/env node

/**
 * Database Migration Runner
 * Executes SQL migration files against Neon PostgreSQL
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  
  try {
    // Get the specific migration file to run
    const migrationFile = process.argv[2];
    
    if (!migrationFile) {
      console.error('❌ Please specify a migration file');
      console.error('Usage: node run-migration.js <migration-file>');
      process.exit(1);
    }

    const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log(`\n🚀 Running migration: ${migrationFile}`);
    console.log('━'.repeat(60));
    
    const client = await pool.connect();
    
    try {
      // Execute the migration
      await client.query(sql);
      console.log(`✅ Migration completed successfully!`);
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

runMigrations();
