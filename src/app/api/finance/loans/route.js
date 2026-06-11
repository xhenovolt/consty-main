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

    let q = `SELECT el.*, 
                        fs.first_name as from_staff_name, 
                        ts.first_name as to_staff_name,
                        u.email as approved_by_email
                 FROM employee_loans el
                 LEFT JOIN staff fs ON fs.id = el.from_staff_id
                 LEFT JOIN staff ts ON ts.id = el.to_staff_id
                 LEFT JOIN users u ON u.id = el.approved_by
                 WHERE 1=1`;
    
    const params = [];
    let paramIndex = 1;

    if (status) {
      q += ` AND el.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (staffId) {
      q += ` AND (el.from_staff_id = $${paramIndex} OR el.to_staff_id = $${paramIndex})`;
      params.push(staffId);
      paramIndex++;
    }

    q += ` ORDER BY el.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(q, params);

    return NextResponse.json({
      loans: result.rows,
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
    const { from_staff_id, to_staff_id, amount, currency, description } = await request.json();

    if (!from_staff_id || !to_staff_id || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid loan data' }, { status: 400 });
    }

    if (from_staff_id === to_staff_id) {
      return NextResponse.json({ error: 'Cannot create loan to self' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO employee_loans (from_staff_id, to_staff_id, amount, currency, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [from_staff_id, to_staff_id, amount, currency || 'UGX', description]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
