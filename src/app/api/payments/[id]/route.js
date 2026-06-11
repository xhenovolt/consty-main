import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'finance.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const result = await query(
      `SELECT p.*, d.title as deal_title, a.name as account_name, COALESCE(c.company_name, d.client_name) as client_name
       FROM payments p JOIN deals d ON p.deal_id = d.id JOIN accounts a ON p.account_id = a.id LEFT JOIN clients c ON d.client_id = c.id
       WHERE p.id = $1`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch payment' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'finance.create');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const body = await request.json();
    const fields = ['status','method','reference','payment_date','notes'];
    const updates = [];
    const values = [];
    fields.forEach(f => { if (body[f] !== undefined) { values.push(body[f]); updates.push(`${f} = $${values.length}`); } });
    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    if (body.status === 'completed') updates.push(`received_at = NOW()`);
    values.push(id);
    const result = await query(`UPDATE payments SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update payment' }, { status: 500 });
  }
}
