import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const r4 = await pool.query("SELECT id, username, email, role, staff_id, is_active, status FROM users");
console.log(`\nUSERS (${r4.rowCount} total):`);
console.log(JSON.stringify(r4.rows, null, 2));

const r5 = await pool.query("SELECT id, name, email, user_id, role_id FROM staff");
console.log(`\nSTAFF (${r5.rowCount} total):`);
console.log(JSON.stringify(r5.rows, null, 2));

const r6 = await pool.query("SELECT id, name, authority_level FROM roles ORDER BY authority_level DESC");
console.log(`\nROLES (${r6.rowCount} total):`);
console.log(JSON.stringify(r6.rows, null, 2));

const r7 = await pool.query("SELECT * FROM staff_roles LIMIT 20");
console.log(`\nSTAFF_ROLES (${r7.rowCount} rows):`);
console.log(JSON.stringify(r7.rows, null, 2));

const r8 = await pool.query("SELECT id, username, email, role FROM users WHERE staff_id IS NULL");
console.log(`\nORPHAN USERS (no staff_id) - ${r8.rowCount}:`);
console.log(JSON.stringify(r8.rows, null, 2));

const r9 = await pool.query("SELECT s.id, s.name, s.user_id FROM staff s WHERE s.user_id IS NULL");
console.log(`\nSTAFF WITHOUT USER (${r9.rowCount}):`);
console.log(JSON.stringify(r9.rows, null, 2));

await pool.end();
