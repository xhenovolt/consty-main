import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'finance.view');
    if (perm instanceof NextResponse) return perm;
    const { id } = await params;
    const result = await query(`SELECT * FROM v_account_balances WHERE account_id = $1`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    const transactions = await query(
      `SELECT * FROM ledger WHERE account_id = $1 ORDER BY entry_date DESC, created_at DESC LIMIT 50`, [id]
    );
    return NextResponse.json({ success: true, data: { ...result.rows[0], transactions: transactions.rows } });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch account' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'finance.create');
    if (perm instanceof NextResponse) return perm;
    const { id } = await params;
    const body = await request.json();
    const allowed = ['name', 'type', 'currency', 'description', 'institution', 'account_number'];
    const updates = [];
    const values = [];
    allowed.forEach(f => {
      if (body[f] !== undefined) { values.push(body[f]); updates.push(`${f} = $${values.length}`); }
    });
    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    values.push(id);
    const result = await query(
      `UPDATE accounts SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update account' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const perm = await requirePermission(request, 'finance.create');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === 'disable') {
      const result = await query(
        `UPDATE accounts SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [id]
      );
      if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: result.rows[0] });
    }

    if (action === 'enable') {
      const result = await query(
        `UPDATE accounts SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [id]
      );
      if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: result.rows[0] });
    }

    if (action === 'adjust_balance') {
      const { amount, reason, entry_date } = body;
      if (!amount || parseFloat(amount) === 0) {
        return NextResponse.json({ success: false, error: 'Amount is required and must be non-zero' }, { status: 400 });
      }
      if (!reason || reason.trim().length < 5) {
        return NextResponse.json({ success: false, error: 'A reason (minimum 5 characters) is required for manual adjustments' }, { status: 400 });
      }
      const acct = await query(`SELECT * FROM accounts WHERE id = $1`, [id]);
      if (!acct.rows[0]) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });

      const entry = await query(
        `INSERT INTO ledger (account_id, amount, currency, source_type, description, category, entry_date, created_by, metadata)
         VALUES ($1, $2, $3, 'manual_adjustment', $4, 'adjustment', $5::date, $6, $7) RETURNING *`,
        [
          id,
          parseFloat(amount),
          acct.rows[0].currency,
          reason,
          entry_date || new Date().toISOString().split('T')[0],
          auth.userId,
          JSON.stringify({ manual: true, adjusted_by: auth.userId, reason, flagged: true }),
        ]
      );
      return NextResponse.json({
        success: true,
        data: entry.rows[0],
        warning: 'Manual balance adjustment recorded and flagged for audit review.',
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'finance.delete');
    if (perm instanceof NextResponse) return perm;
    const { id } = await params;

    // Check for blocking FK dependencies
    const blocking = await query(
      `SELECT
        (SELECT COUNT(*) FROM payouts WHERE account_id = $1) AS payouts,
        (SELECT COUNT(*) FROM employee_accounts WHERE account_id = $1) AS employee_accounts,
        (SELECT COUNT(*) FROM ledger WHERE account_id = $1) AS transactions`,
      [id]
    );
    const { payouts, employee_accounts, transactions } = blocking.rows[0];

    if (parseInt(payouts) > 0 || parseInt(employee_accounts) > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot delete: account has ${payouts} payout(s) and ${employee_accounts} employee link(s). Disable it instead.`,
      }, { status: 409 });
    }

    if (parseInt(transactions) > 0) {
      // Has ledger history — soft delete only
      const result = await query(
        `UPDATE accounts SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [id]
      );
      if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
      return NextResponse.json({
        success: true,
        data: result.rows[0],
        message: 'Account disabled (has transaction history — cannot be permanently deleted for audit integrity).',
      });
    }

    // No transactions — hard delete
    const result = await query(`DELETE FROM accounts WHERE id = $1 RETURNING *`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0], message: 'Account permanently deleted.' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete account: ' + error.message }, { status: 500 });
  }
}

