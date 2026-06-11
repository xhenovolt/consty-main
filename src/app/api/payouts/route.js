import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/payouts — List all payouts
export async function GET(request) {
  const perm = await requirePermission(request, 'staff.view');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const { searchParams } = new URL(request.url);
    const staff_id = searchParams.get('staff_id');
    const status = searchParams.get('status');
    const payout_type = searchParams.get('payout_type');
    
    let sql = `SELECT p.*, s.name as staff_name, a.name as account_name
               FROM payouts p
               LEFT JOIN staff s ON p.staff_id = s.id
               LEFT JOIN accounts a ON p.account_id = a.id
               WHERE 1=1`;
    const params = [];
    
    if (staff_id) { params.push(staff_id); sql += ` AND p.staff_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND p.status = $${params.length}`; }
    if (payout_type) { params.push(payout_type); sql += ` AND p.payout_type = $${params.length}`; }
    
    sql += ` ORDER BY p.payout_date DESC`;
    
    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Payouts] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch payouts' }, { status: 500 });
  }
}

// POST /api/payouts — Create payout
export async function POST(request) {
  const perm = await requirePermission(request, 'staff.edit');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const body = await request.json();
    const {
      staff_id, account_id, amount, currency, payout_type,
      description, reference, payout_date, notes
    } = body;
    
    if (!staff_id || !account_id || !amount) {
      return NextResponse.json({
        success: false,
        error: 'staff_id, account_id, and amount are required'
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
    
    // Check if employee account exists
    const empAcctCheck = await query(
      'SELECT id FROM employee_accounts WHERE staff_id = $1',
      [staff_id]
    );
    
    const result = await query(
      `INSERT INTO payouts
       (staff_id, employee_account_id, account_id, amount, currency, payout_type,
        status, description, reference, payout_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        staff_id,
        empAcctCheck.rows[0]?.id || null,
        account_id,
        parseFloat(amount),
        currency || 'UGX',
        payout_type || 'salary',
        description || null,
        reference || null,
        payout_date || new Date().toISOString().split('T')[0],
        notes || null,
        perm.auth.userId
      ]
    );
    
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Payouts] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create payout' }, { status: 500 });
  }
}
