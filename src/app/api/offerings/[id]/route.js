import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'offerings.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const result = await query(`SELECT o.*, (SELECT COUNT(*) FROM deals d WHERE d.offering_id = o.id) as deal_count FROM offerings o WHERE o.id = $1`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Offering not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch offering' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'offerings.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const body = await request.json();
    const fields = ['name','type','description','default_price','currency','unit','is_active','metadata'];
    const updates = [];
    const values = [];
    fields.forEach(f => { if (body[f] !== undefined) { values.push(f === 'metadata' ? JSON.stringify(body[f]) : body[f]); updates.push(`${f} = $${values.length}`); } });
    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    values.push(id);
    const result = await query(`UPDATE offerings SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Offering not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update offering' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'offerings.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const deals = await query(`SELECT COUNT(*) FROM deals WHERE offering_id = $1`, [id]);
    if (parseInt(deals.rows[0].count) > 0) {
      return NextResponse.json({ success: false, error: 'Cannot delete offering linked to deals. Deactivate instead.' }, { status: 409 });
    }
    const result = await query(`DELETE FROM offerings WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Offering not found' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Offering deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete offering' }, { status: 500 });
  }
}
