#!/usr/bin/env node

/**
 * Comprehensive Migration Runner for Consty
 * Executes all SQL migrations in the correct order
 * Idempotent and safe for development environments
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

// Migration execution order (critical for dependencies)
const MIGRATIONS_ORDERED = [
  // 1. Base domain tables
  '001_create_domains.sql',
  
  // 2. Sales and invoice infrastructure
  '005_deals_to_sales_automation.sql',
  '006_create_invoices_table.sql',
  '006_pipeline_analytics.sql',
  '007_add_equity_type.sql',
  '007_create_invoice_items_table.sql',
  '007_update_deals_schema.sql',
  
  // 3. Equity and shares
  '008_corporate_equity_refactor.sql',
  '008_two_layer_share_model.sql',
  '009_add_equity_type_classification.sql',
  '010_two_layer_share_model.sql',
  '011_set_share_par_value.sql',
  '012_upgrade_to_authorized_shares.sql',
  '014_create_shareholdings_complete.sql',
  '018_add_share_columns.sql',
  '019_add_issuance_columns.sql',
  '026_add_equity_type_to_share_issuances.sql',
  
  // 4. User and session management
  '013_create_sessions.sql',
  '015_user_access_governance.sql',
  '016_add_online_status_tracking.sql',
  '017_add_user_full_name.sql',
  
  // 5. Sales normalization
  '020_make_deals_nullable.sql',
  '021_make_created_by_nullable.sql',
  '022_fix_sales_schema.sql',
  '023_add_client_name_to_deals.sql',
  
  // 6. Revenue and financial architecture
  '024_unified_revenue_model.sql',
  '030_financial_architecture_redesign.sql',
  
  // 7. Prospect CRM system
  '027_implement_prospect_crm_system.sql',
  '028_fix_prospect_views.sql',
  '028_prospect_activity_log.sql',
  '029_fix_prospect_uuid_types.sql',
  '031_prospect_client_unification.sql',
  
  // 8. Final structural stability
  '032_structural_stabilization.sql',
  
  // 9. Shared table creation (if needed)
  'create_sales_tables.sql',
  'create_shares_tables.sql',
];

async function runAllMigrations() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  });

  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const errors = [];

  try {
    console.log('\n🚀 Consty Database Migration Runner');
    console.log('━'.repeat(70));
    console.log(`📅 ${new Date().toISOString()}`);
    console.log('━'.repeat(70) + '\n');

    const client = await pool.connect();

    try {
      for (const migration of MIGRATIONS_ORDERED) {
        const migrationPath = path.join(__dirname, '..', 'migrations', migration);

        // Check if file exists
        if (!fs.existsSync(migrationPath)) {
          console.log(`⊘  SKIP: ${migration} (file not found)`);
          skippedCount++;
          continue;
        }

        console.log(`🔄 Executing: ${migration}`);

        try {
          const sql = fs.readFileSync(migrationPath, 'utf-8');

          // Execute the full migration as a single statement
          // Most migrations are designed to be idempotent
          await client.query(sql);

          console.log(`   ✅ SUCCESS\n`);
          successCount++;
        } catch (error) {
          console.error(`   ❌ ERROR: ${error.message}`);
          errors.push({ migration, error: error.message });
          console.log();
          failedCount++;
          
          // Continue with next migration instead of failing completely
          // This allows partial recovery and safe reruns
        }
      }

      // Summary
      console.log('━'.repeat(70));
      console.log('📊 MIGRATION SUMMARY');
      console.log('━'.repeat(70));
      console.log(`✅ Successful: ${successCount}`);
      console.log(`⊘  Skipped:    ${skippedCount}`);
      console.log(`❌ Failed:     ${failedCount}`);

      if (errors.length > 0) {
        console.log('\n⚠️  FAILED MIGRATIONS:');
        errors.forEach(({ migration, error }) => {
          console.log(`   - ${migration}`);
          console.log(`     ${error}`);
        });
      }

      console.log('━'.repeat(70) + '\n');

      if (failedCount === 0) {
        console.log('✨ All migrations completed successfully!\n');
      } else {
        console.log('⚠️  Some migrations failed. Please review and fix manually.\n');
      }
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

// Run migrations
runAllMigrations().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
