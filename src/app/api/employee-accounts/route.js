import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/employee-accounts — List all employee accounts
export async function GET(request) {
  const perm = await requirePermission(request, 'staff.view');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const result = await query(
      `SELECT ea.*, s.name as staff_name, a.name as account_name
       FROM employee_accounts ea
       LEFT JOIN staff s ON ea.staff_id = s.id
       LEFT JOIN accounts a ON ea.account_id = a.id
       ORDER BY ea.created_at DESC`
    );
    
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Employee Accounts] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch employee accounts' }, { status: 500 });
  }
}

// POST /api/employee-accounts — Create employee account
export async function POST(request) {
  const perm = await requirePermission(request, 'staff.edit');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const body = await request.json();
    const { staff_id, account_id, currency, notes } = body;
    
    if (!staff_id || !account_id) {
      return NextResponse.json({
        success: false,
        error: 'staff_id and account_id are required'
      }, { status: 400 });
    }
    
    // Validate staff and account exist
    const [staffCheck, accountCheck] = await Promise.all([
      query('SELECT id FROM staff WHERE id = $1', [staff_id]),
      query('SELECT id FROM accounts WHERE id = $1', [account_id])
    ]);
    
    if (!staffCheck.rows[0]) {
      return NextResponse.json({ success: false, error: 'Staff member not found' }, { status: 404 });
    }
    if (!accountCheck.rows[0]) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }
    
    // Check if employee account already exists
    const existingCheck = await query(
      'SELECT id FROM employee_accounts WHERE staff_id = $1',
      [staff_id]
    );
    
    if (existingCheck.rows[0]) {
      return NextResponse.json({
        success: false,
        error: 'Employee account already exists for this staff member'
      }, { status: 409 });
    }
    
    const result = await query(
      `INSERT INTO employee_accounts
       (staff_id, account_id, balance, currency, status, notes)
       VALUES ($1, $2, 0.00, $3, 'active', $4)
       RETURNING *`,
      [staff_id, account_id, currency || 'UGX', notes || null]
    );
    
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Employee Accounts] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create employee account' }, { status: 500 });
  }
}
