import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/transfers
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'finance.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const result = await query(
      `SELECT t.*, fa.name as from_account_name, ta.name as to_account_name
       FROM transfers t
       JOIN accounts fa ON t.from_account_id = fa.id
       JOIN accounts ta ON t.to_account_id = ta.id
       ORDER BY t.transfer_date DESC`
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch transfers' }, { status: 500 });
  }
}

// POST /api/transfers - Create transfer WITH two ledger entries
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'finance.create');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { from_account_id, to_account_id, amount, currency, to_amount, to_currency, exchange_rate, description, reference, transfer_date } = body;
    
    if (!from_account_id || !to_account_id || !amount) {
      return NextResponse.json({ success: false, error: 'from_account_id, to_account_id, and amount are required' }, { status: 400 });
    }
    if (from_account_id === to_account_id) {
      return NextResponse.json({ success: false, error: 'Cannot transfer to same account' }, { status: 400 });
    }

    const txDate = transfer_date || new Date().toISOString().split('T')[0];

    // Get account names for description
    const fromAcct = await query(`SELECT name FROM accounts WHERE id = $1`, [from_account_id]);
    const toAcct = await query(`SELECT name FROM accounts WHERE id = $1`, [to_account_id]);

    const transferResult = await query(
      `INSERT INTO transfers (from_account_id, to_account_id, amount, currency, to_amount, to_currency, exchange_rate, description, reference, transfer_date, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'completed',$11) RETURNING *`,
      [from_account_id, to_account_id, amount, currency||'UGX', to_amount||null, to_currency||null,
       exchange_rate||null, description||null, reference||null, txDate, auth.userId]
    );

    const transfer = transferResult.rows[0];
    const fromName = fromAcct.rows[0]?.name || 'Unknown';
    const toName = toAcct.rows[0]?.name || 'Unknown';

    // Create DEBIT ledger entry (money out of from_account)
    const debitResult = await query(
      `INSERT INTO ledger (account_id, amount, currency, source_type, source_id, description, category, entry_date, created_by)
       VALUES ($1,$2,$3,'transfer_out',$4,$5,'transfer',$6,$7) RETURNING id`,
      [from_account_id, -Math.abs(amount), currency||'UGX', transfer.id,
       `Transfer to ${toName}${description ? ': ' + description : ''}`, txDate, auth.userId]
    );

    // Create CREDIT ledger entry (money into to_account)
    const creditAmount = to_amount || amount;
    const creditCurrency = to_currency || currency || 'UGX';
    const creditResult = await query(
      `INSERT INTO ledger (account_id, amount, currency, source_type, source_id, description, category, entry_date, created_by)
       VALUES ($1,$2,$3,'transfer_in',$4,$5,'transfer',$6,$7) RETURNING id`,
      [to_account_id, Math.abs(creditAmount), creditCurrency, transfer.id,
       `Transfer from ${fromName}${description ? ': ' + description : ''}`, txDate, auth.userId]
    );

    // Link ledger entries back to transfer
    await query(`UPDATE transfers SET ledger_debit_id = $1, ledger_credit_id = $2 WHERE id = $3`,
      [debitResult.rows[0].id, creditResult.rows[0].id, transfer.id]);

    dispatch('transfer_completed', { entityType: 'transfer', entityId: transfer.id, description: `Transfer: ${currency || 'UGX'} ${Number(amount).toLocaleString()} from ${fromName} to ${toName}`, metadata: { amount, currency: currency || 'UGX', from: fromName, to: toName }, actorId: auth.userId }).catch(() => {});

    return NextResponse.json({ success: true, data: transfer }, { status: 201 });
  } catch (error) {
    console.error('[Transfers] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create transfer' }, { status: 500 });
  }
}
