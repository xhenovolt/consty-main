import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/payouts/[id] — Get individual payout
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'staff.view');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const { id } = params;
    
    const result = await query(
      `SELECT p.*, s.name as staff_name, a.name as account_name
       FROM payouts p
       LEFT JOIN staff s ON p.staff_id = s.id
       LEFT JOIN accounts a ON p.account_id = a.id
       WHERE p.id = $1`,
      [id]
    );
    
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Payout not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Payouts] GET/:id error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch payout' }, { status: 500 });
  }
}

// PATCH /api/payouts/[id] — Update payout status
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'staff.edit');
  if (perm instanceof NextResponse) return perm;
  
  try {
    const { id } = params;
    const body = await request.json();
    const { status, processed_at } = body;
    
    if (!status) {
      return NextResponse.json({ success: false, error: 'status is required' }, { status: 400 });
    }
    
    const result = await query(
      `UPDATE payouts
       SET status = $1, processed_at = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, processed_at || null, id]
    );
    
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Payout not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Payouts] PATCH/:id error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update payout' }, { status: 500 });
  }
}
