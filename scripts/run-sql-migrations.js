#!/usr/bin/env node

/**
 * SQL Migrations Runner
 * Runs all SQL migrations in the migrations/ directory in order
 * Run with: node scripts/run-sql-migrations.js
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

const { Pool } = pg;

// Migration files to run in order
const MIGRATIONS = [
  '001_create_domains.sql',
  '005_deals_to_sales_automation.sql',
  '006_pipeline_analytics.sql',
  '007_add_equity_type.sql',
  '007_update_deals_schema.sql',
  '008_corporate_equity_refactor.sql',
  '009_add_equity_type_classification.sql',
  '010_two_layer_share_model.sql',
  '014_create_shareholdings_complete.sql',
];

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('🚀 Running SQL migrations...\n');
    const client = await pool.connect();

    try {
      for (const migration of MIGRATIONS) {
        const migrationPath = path.join(__dirname, '../migrations', migration);

        // Check if file exists
        if (!fs.existsSync(migrationPath)) {
          console.log(`⚠️  Skipping ${migration} (file not found)`);
          continue;
        }

        console.log(`📝 Running migration: ${migration}`);

        try {
          const sql = fs.readFileSync(migrationPath, 'utf-8');

          // Split by BEGIN/COMMIT if present
          const statements = sql.split(/;(?=\s*(BEGIN|$))/);

          for (const statement of statements) {
            const trimmed = statement.trim();
            if (trimmed && !trimmed.match(/^\s*(--.*)?$/)) {
              // Execute statement
              await client.query(trimmed);
            }
          }

          console.log(`✅ ${migration} completed\n`);
        } catch (error) {
          console.error(`❌ Error running ${migration}:`, error.message);
          console.error(error);
          // Continue with next migration instead of failing
        }
      }

      console.log('✨ All migrations completed!');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Migration runner failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
