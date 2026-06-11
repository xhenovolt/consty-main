import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'finance.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');
    const status = searchParams.get('status') || 'active';

    let q = `SELECT sa.id, sa.staff_id, a.id as account_id, a.account_name, a.balance, 
                        a.currency, a.status as account_status, sa.status, 
                        s.first_name, s.last_name, s.email
                 FROM staff_accounts sa
                 LEFT JOIN accounts a ON a.id = sa.account_id
                 LEFT JOIN staff s ON s.id = sa.staff_id
                 WHERE 1=1`;
    
    const params = [];
    let paramIndex = 1;

    if (staffId) {
      q += ` AND sa.staff_id = $${paramIndex}`;
      params.push(staffId);
      paramIndex++;
    }

    if (status) {
      q += ` AND sa.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    q += ` ORDER BY s.first_name`;

    const result = await query(q, params);

    return NextResponse.json({
      accounts: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, 'finance.manage');
  if (perm instanceof NextResponse) return perm;

  try {
    const { staff_id, account_id } = await request.json();

    if (!staff_id || !account_id) {
      return NextResponse.json({ error: 'Staff ID and account ID required' }, { status: 400 });
    }

    // Check if staff already has an account
    const existing = await query(
      `SELECT id FROM staff_accounts WHERE staff_id = $1`,
      [staff_id]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'Staff member already has a linked financial account' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO staff_accounts (staff_id, account_id, status)
       VALUES ($1, $2, 'active')
       RETURNING *`,
      [staff_id, account_id]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
