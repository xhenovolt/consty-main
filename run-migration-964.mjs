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
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    const client = await pool.connect();
    const file = path.join(__dirname, 'migrations', '964_license_engine.sql');
    const sql = fs.readFileSync(file, 'utf-8');
    console.log('Running migration 964: License Engine...');
    await client.query(sql);
    console.log('Migration 964 completed.');
    client.release();
  } catch (err) {
    console.error('Migration 964 failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
