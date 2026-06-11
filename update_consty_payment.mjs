#!/usr/bin/env node
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

(async () => {
  try {
    // Find payments in USD
    console.log('Finding USD payments...\n');
    const payments = await pool.query('SELECT id, amount, currency, reference, created_at FROM payments WHERE currency = $1 ORDER BY created_at DESC', ['USD']);
    
    if (payments.rows.length === 0) {
      console.log('No USD payments found');
      await pool.end();
      return;
    }
    
    console.log('USD Payments found:');
    payments.rows.forEach((row, i) => {
      console.log(`${i+1}. ID: ${row.id} | Amount: ${row.amount} USD | Reference: ${row.reference} | Created: ${row.created_at}`);
    });
    
    // Update first USD payment (assume this is the CONSTY one)
    // Convert $150 to UGX using rate of 3,800 UGX per 1 USD
    const paymentId = payments.rows[0].id;
    const oldAmount = payments.rows[0].amount;
    const newAmount = Math.round(parseFloat(oldAmount) * 3800);
    
    console.log(`\nUpdating payment ${paymentId}:`);
    console.log(`  Old: ${oldAmount} USD`);
    console.log(`  New: ${newAmount} UGX (using 3800 rate)`);
    
    const update = await pool.query(
      'UPDATE payments SET amount = $1, currency = $2, updated_at = NOW() WHERE id = $3 RETURNING id, amount, currency',
      [newAmount, 'UGX', paymentId]
    );
    
    console.log('\nUpdate successful:');
    console.log(JSON.stringify(update.rows[0], null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
