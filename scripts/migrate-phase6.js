#!/usr/bin/env node

/**
 * Database migration script - Phase 6
 * Adds permission system and soft delete support
 * Run with: node scripts/migrate-phase6.js
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

const { Pool } = pg;

async function migrateDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('🚀 Running Phase 6 migration...\n');
    const client = await pool.connect();

    try {
      // Migrate users table
      console.log('📝 Migrating users table...');
      await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS full_name TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
      `);
      
      // Try to drop constraint if it exists
      try {
        await client.query('ALTER TABLE users DROP CONSTRAINT valid_role;');
      } catch (e) {
        // Constraint might not exist, continue
      }

      await client.query(`
        ALTER TABLE users
        ADD CONSTRAINT valid_role CHECK (role IN ('FOUNDER', 'FINANCE', 'SALES', 'VIEWER'));

        ALTER TABLE users
        ADD CONSTRAINT valid_status CHECK (status IN ('active', 'suspended'));

        CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      `);
      console.log('✅ Users table migrated\n');

      // Create staff_profiles table
      console.log('📝 Creating staff_profiles table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS staff_profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          department TEXT,
          title TEXT,
          phone TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_staff_profiles_user_id ON staff_profiles(user_id);
        CREATE INDEX IF NOT EXISTS idx_staff_profiles_department ON staff_profiles(department);
      `);
      console.log('✅ Staff profiles table created\n');

      // Migrate assets table
      console.log('📝 Migrating assets table...');
      await client.query(`
        ALTER TABLE assets
        ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

        CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON assets(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_assets_locked ON assets(locked);
      `);
      console.log('✅ Assets table migrated\n');

      // Migrate liabilities table
      console.log('📝 Migrating liabilities table...');
      await client.query(`
        ALTER TABLE liabilities
        ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

        CREATE INDEX IF NOT EXISTS idx_liabilities_deleted_at ON liabilities(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_liabilities_locked ON liabilities(locked);
      `);
      console.log('✅ Liabilities table migrated\n');

      // Migrate deals table
      console.log('📝 Migrating deals table...');
      await client.query(`
        ALTER TABLE deals
        ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

        CREATE INDEX IF NOT EXISTS idx_deals_deleted_at ON deals(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_deals_locked ON deals(locked);
      `);
      console.log('✅ Deals table migrated\n');

      // Update audit_logs constraints
      console.log('📝 Updating audit_logs constraints...');
      
      // Try to drop existing constraint
      try {
        await client.query('ALTER TABLE audit_logs DROP CONSTRAINT valid_action;');
      } catch (e) {
        // Constraint might not exist, continue
      }

      await client.query(`
        ALTER TABLE audit_logs
        ADD CONSTRAINT valid_action CHECK (action IN (
          'LOGIN_SUCCESS',
          'LOGIN_FAILURE',
          'LOGOUT',
          'REGISTER',
          'TOKEN_VALIDATION_FAILURE',
          'PROTECTED_ROUTE_ACCESS',
          'ROUTE_DENIED',
          'USER_CREATED',
          'USER_UPDATED',
          'USER_DELETED',
          'ROLE_CHANGED',
          'STAFF_CREATED',
          'STAFF_SUSPENDED',
          'STAFF_REACTIVATED',
          'ASSET_CREATE',
          'ASSET_CREATE_DENIED',
          'ASSET_UPDATE',
          'ASSET_UPDATE_DENIED',
          'ASSET_DELETE',
          'ASSET_DELETE_DENIED',
          'ASSET_RESTORE',
          'ASSET_LOCK',
          'ASSET_UNLOCK',
          'LIABILITY_CREATE',
          'LIABILITY_CREATE_DENIED',
          'LIABILITY_UPDATE',
          'LIABILITY_UPDATE_DENIED',
          'LIABILITY_DELETE',
          'LIABILITY_DELETE_DENIED',
          'LIABILITY_RESTORE',
          'LIABILITY_LOCK',
          'LIABILITY_UNLOCK',
          'DEAL_CREATE',
          'DEAL_CREATE_DENIED',
          'DEAL_UPDATE',
          'DEAL_UPDATE_DENIED',
          'DEAL_DELETE',
          'DEAL_DELETE_DENIED',
          'DEAL_RESTORE',
          'DEAL_LOCK',
          'DEAL_UNLOCK',
          'DEAL_STAGE_CHANGE',
          'DEAL_STAGE_CHANGE_DENIED'
        ));
      `);
      console.log('✅ Audit logs updated\n');

      console.log('✨ Phase 6 migration complete!');
      console.log('✅ Multi-user permission system enabled');
      console.log('✅ Soft delete & record locking enabled');
      console.log('✅ Staff management tables created');
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

migrateDatabase();
