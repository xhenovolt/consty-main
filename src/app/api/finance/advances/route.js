import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'finance.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const staffId = searchParams.get('staffId');
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = parseInt(searchParams.get('offset')) || 0;

    let q = `SELECT sa.*,
                        s.first_name, s.last_name, s.email,
                        u.email as approved_by_email
                 FROM salary_advances sa
                 LEFT JOIN staff s ON s.id = sa.staff_id
                 LEFT JOIN users u ON u.id = sa.approved_by
                 WHERE 1=1`;
    
    const params = [];
    let paramIndex = 1;

    if (status) {
      q += ` AND sa.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (staffId) {
      q += ` AND sa.staff_id = $${paramIndex}`;
      params.push(staffId);
      paramIndex++;
    }

    q += ` ORDER BY sa.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(q, params);

    return NextResponse.json({
      advances: result.rows,
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
    const { staff_id, amount, currency, reason, approved_by } = await request.json();

    if (!staff_id || !amount || !reason || amount <= 0) {
      return NextResponse.json({ error: 'Staff ID, amount, and reason required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO salary_advances (staff_id, amount, currency, reason, approved_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [staff_id, amount, currency || 'UGX', reason, approved_by]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
