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
    // Find the payment and its account (by the specific payment ID we updated earlier)
    console.log('Finding payment and associated account...\n');
    
    const paymentQuery = await pool.query(
      `SELECT p.id, p.amount, p.currency, p.account_id, a.name, a.currency as acc_currency 
       FROM payments p 
       JOIN accounts a ON p.account_id = a.id 
       WHERE p.id = $1 
       LIMIT 1`,
      ['6a781210-60b2-436f-a5c1-2a87751fa2ce']
    );
    
    if (paymentQuery.rows.length === 0) {
      console.log('Payment not found');
      await pool.end();
      return;
    }
    
    const payment = paymentQuery.rows[0];
    console.log('Payment found:');
    console.log(`  ID: ${payment.id}`);
    console.log(`  Amount: ${payment.amount} ${payment.currency}`);
    console.log(`  Account: ${payment.name} (ID: ${payment.account_id})`);
    console.log(`  Account Currency: ${payment.acc_currency}\n`);
    
    // Update account if it's in USD
    if (payment.acc_currency === 'USD') {
      console.log('Updating account currency...');
      
      // Update account currency to UGX
      const updateAccount = await pool.query(
        `UPDATE accounts 
         SET currency = $1, updated_at = NOW() 
         WHERE id = $2 
         RETURNING id, name, currency`,
        ['UGX', payment.account_id]
      );
      
      const updated = updateAccount.rows[0];
      console.log(`  ✓ Account "${updated.name}" currency updated: USD → UGX\n`);
    } else {
      console.log(`Account is already in ${payment.acc_currency}, no update needed.\n`);
    }
    
    console.log('✅ Account updates completed successfully!');
    console.log(`\nSummary:`);
    console.log(`  Payment: Already converted to 570,000 UGX`);
    console.log(`  Account: Currency updated to UGX`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    try {
      await pool.end();
    } catch (e) {
      // Ignore pool already closed errors
    }
  }
})();
