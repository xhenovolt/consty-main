import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/clients/[id]
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'clients', 'view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const result = await query(
      `SELECT c.*,
        (SELECT json_agg(d.* ORDER BY d.created_at DESC) FROM deals d WHERE d.client_id = c.id) as deals,
        (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN deals d ON p.deal_id = d.id WHERE d.client_id = c.id AND p.status = 'completed') as total_paid,
        p.company_name as prospect_company
       FROM clients c LEFT JOIN prospects p ON c.prospect_id = p.id WHERE c.id = $1`, [id]
    );
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch client' }, { status: 500 });
  }
}

// PUT /api/clients/[id]
export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'clients', 'edit');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const body = await request.json();
    const fields = ['company_name','contact_name','email','phone','website','industry','billing_address','tax_id','payment_terms','preferred_currency','status','notes','tags'];
    const updates = [];
    const values = [];
    fields.forEach(f => { if (body[f] !== undefined) { values.push(body[f]); updates.push(`${f} = $${values.length}`); } });
    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    values.push(id);
    const result = await query(`UPDATE clients SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update client' }, { status: 500 });
  }
}

// DELETE /api/clients/[id]
export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'clients', 'delete');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    // Check for active deals
    const deals = await query(`SELECT COUNT(*) FROM deals WHERE client_id = $1 AND status NOT IN ('completed','cancelled')`, [id]);
    if (parseInt(deals.rows[0].count) > 0) {
      return NextResponse.json({ success: false, error: 'Cannot delete client with active deals' }, { status: 409 });
    }
    const result = await query(`DELETE FROM clients WHERE id = $1 RETURNING id, company_name`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Client deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete client' }, { status: 500 });
  }
}
