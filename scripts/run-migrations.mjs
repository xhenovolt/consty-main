#!/usr/bin/env node

/**
 * Migration Runner for Consty Core Systems Upgrade
 * Applies migrations 946 and 947
 * 
 * Usage: node scripts/run-migrations.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Load environment variables
dotenvConfig({ path: path.join(projectRoot, '.env.local') });

// Get database connection from environment
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL or POSTGRES_URL not set in environment');
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

const migrationsToRun = [
  '946_system_tech_complete_and_hrm_foundation_clean.sql',
  '947_multi_currency_financial_engine.sql',
];

async function runMigrations() {
  console.log('🚀 Starting Consty Core Systems Migration...\n');

  for (const migrationFile of migrationsToRun) {
    const migrationPath = path.join(projectRoot, 'migrations', migrationFile);

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    try {
      console.log(`▶  Running migration: ${migrationFile}`);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      // Split carefully on semicolons that are followed by newline or end of file
      const statements = sql
        .split(/;\s*(?=\n|\r|$)/m)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      console.log(`   Executing ${statements.length} statements...`);
      
      let successCount = 0;
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        try {
          await pool.query(statement);
          successCount++;
        } catch (err) {
          const msg = err.message.split('\n')[0];
          console.log(`   ⚠  Stmt ${i + 1}/${statements.length}: ${msg}`);
        }
      }
      
      console.log(`✅ Migration complete (${successCount}/${statements.length} succeeded)\n`);
    } catch (err) {
      console.error(`❌ Migration failed: ${migrationFile}`);
      console.error(`   Error: ${err.message}\n`);
      // Don't exit, try next migration
    }
  }

  console.log('✨ Migration process completed!\n');
  
  await pool.end();
  process.exit(0);
}

runMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
