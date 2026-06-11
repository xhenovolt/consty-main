import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'finance.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = parseInt(searchParams.get('offset')) || 0;

    let q = `SELECT am.*, u.email as performed_by_email
                 FROM account_mutations am
                 LEFT JOIN users u ON u.id = am.performed_by
                 WHERE 1=1`;
    
    const params = [];
    let paramIndex = 1;

    if (accountId) {
      q += ` AND am.account_id = $${paramIndex}`;
      params.push(accountId);
      paramIndex++;
    }

    q += ` ORDER BY am.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(q, params);

    return NextResponse.json({
      mutations: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, 'finance.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { account_id, old_value, new_value, reason } = await request.json();

    // SUPERADMIN ONLY
    if (!perm.isSuperadmin) {
      return NextResponse.json(
        { error: 'Only superadmin can mutate account values' },
        { status: 403 }
      );
    }

    if (!account_id || !reason || !new_value) {
      return NextResponse.json({ error: 'Account ID, new value, and reason required' }, { status: 400 });
    }

    // Check 3 mutations per month limit
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const mutationCount = await query(
      `SELECT COUNT(*) as count FROM account_mutations 
       WHERE account_id = $1 AND created_at > $2`,
      [account_id, thirtyDaysAgo]
    );

    if (mutationCount.rows[0].count >= 3) {
      return NextResponse.json(
        { 
          error: 'Account mutation limit reached (3 per month)',
          warning: 'Frequent mutations indicate financial mismanagement'
        },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO account_mutations (account_id, old_value, new_value, reason, performed_by, is_superadmin_only)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [account_id, old_value, new_value, reason, perm.userId]
    );

    // Also update the account balance
    await query(
      `UPDATE accounts SET balance = $1, updated_at = NOW() WHERE id = $2`,
      [new_value, account_id]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
