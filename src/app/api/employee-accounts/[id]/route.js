import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/employee-accounts/[id]
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'staff.view');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const { id } = params;
    
    const result = await query(
      `SELECT ea.*, s.name as staff_name, a.name as account_name
       FROM employee_accounts ea
       LEFT JOIN staff s ON ea.staff_id = s.id
       LEFT JOIN accounts a ON ea.account_id = a.id
       WHERE ea.id = $1`,
      [id]
    );
    
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Employee account not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Employee Account Detail] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch employee account' }, { status: 500 });
  }
}

// PATCH /api/employee-accounts/[id]
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'staff.edit');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const { id } = params;
    const body = await request.json();
    const { balance, status, notes } = body;
    
    const result = await query(
      `UPDATE employee_accounts
       SET balance = COALESCE($1, balance),
           status = COALESCE($2, status),
           notes = COALESCE($3, notes),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [balance, status, notes, id]
    );
    
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Employee account not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Employee Account Detail] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update employee account' }, { status: 500 });
  }
}

// DELETE /api/employee-accounts/[id]
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'staff.delete');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const { id } = params;
    
    const result = await query(
      `DELETE FROM employee_accounts
       WHERE id = $1
       RETURNING id`,
      [id]
    );
    
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Employee account not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[Employee Account Detail] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete employee account' }, { status: 500 });
  }
}
