const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const sql = fs.readFileSync('./migrations/500_invoice_and_intelligence.sql', 'utf8');
  try {
    await pool.query(sql);
    console.log('OK migration 500 applied successfully');
  } catch (e) {
    console.error('ERR:', e.message);
  } finally {
    await pool.end();
  }
}
main();
