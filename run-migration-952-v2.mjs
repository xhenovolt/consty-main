import dotenv from 'dotenv';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL or POSTGRES_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    const migrationFile = path.join(__dirname, 'migrations', '952_secret_management_system_v2.sql');
    
    if (!fs.existsSync(migrationFile)) {
      console.error(`❌ Migration file not found: ${migrationFile}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationFile, 'utf-8');
    console.log('🚀 Running migration 952: Secret Management System...');
    
    await client.query(sql);
    
    console.log('✅ Migration 952 completed successfully!');
    console.log('\n✅ Created tables:');
    console.log('   - secret_view_tokens (for temporary secret viewing)');
    console.log('\n✅ Extended external_connections with:');
    console.log('   - rotated_at (timestamp of last rotation)');
    console.log('   - last_rotated_by (user who performed rotation)');
    console.log('   - rotation_enabled (toggle for rotation feature)');
    console.log('\n✅ Extended audit_logs with:');
    console.log('   - user_agent (for security tracking)');
    
    client.release();
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
