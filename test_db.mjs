import { config as dotenvConfig } from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenvConfig({ path: path.join(__dirname, '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function test() {
  try {
    const tables = await pool.query(`
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('systems', 'staff', 'accounts', 'users')
`);
    console.log('Key tables:', tables.rows.map(r => r.table_name));

    const sys = await pool.query('SELECT COUNT(*) FROM systems');
    console.log('Systems count:', sys.rows[0].count);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

test();
