import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';

export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'finance.manage');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = params;
    const { status, approved_by } = await request.json();

    if (!status) {
      return NextResponse.json({ error: 'Status required' }, { status: 400 });
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'repaid', 'defaulted', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    let updateQuery = `UPDATE employee_loans 
                      SET status = $1, updated_at = NOW()`;
    const params = [status];
    let paramIndex = 2;

    if (status === 'approved' && approved_by) {
      updateQuery += `, approved_by = $${paramIndex}, approved_at = NOW()`;
      params.push(approved_by);
      paramIndex++;
    }

    if (status === 'repaid') {
      updateQuery += `, repaid_at = NOW()`;
    }

    updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);

    const result = await query(updateQuery, params);

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
