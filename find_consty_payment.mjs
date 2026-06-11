import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

try {
  // First, search for all payments in USD
  const result = await pool.query(
    `SELECT id, deal_id, amount, currency, reference, status, payment_date FROM payments 
     WHERE currency = 'USD' 
     ORDER BY amount DESC;`
  );
  
  console.log(`\nPayments in USD (${result.rowCount} total):`);
  console.log(JSON.stringify(result.rows, null, 2));
  
  // Also search in deals table
  const dealsResult = await pool.query(
    `SELECT id, title, description FROM deals LIMIT 20;`
  );
  
  console.log(`\nDeals (${dealsResult.rowCount} total):`);
  console.log(JSON.stringify(dealsResult.rows, null, 2));
  
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await pool.end();
}
