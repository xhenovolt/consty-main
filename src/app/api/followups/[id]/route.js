import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/followups/[id]
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'prospects.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const result = await query(
      `SELECT f.*, p.company_name as prospect_name FROM followups f JOIN prospects p ON f.prospect_id = p.id WHERE f.id = $1`, [id]
    );
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Followup not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch followup' }, { status: 500 });
  }
}

// PUT /api/followups/[id]
export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'prospects.update');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const body = await request.json();

    const fields = ['type','status','scheduled_at','completed_at','summary','outcome','next_action','next_followup_date'];
    const updates = [];
    const values = [];
    fields.forEach(f => {
      if (body[f] !== undefined) { values.push(body[f]); updates.push(`${f} = $${values.length}`); }
    });
    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });

    // Auto-set completed_at when status changes to completed
    if (body.status === 'completed' && !body.completed_at) {
      updates.push(`completed_at = NOW()`);
    }

    values.push(id);
    const result = await query(`UPDATE followups SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Followup not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update followup' }, { status: 500 });
  }
}

// DELETE /api/followups/[id]
export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'prospects.delete');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const result = await query(`DELETE FROM followups WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Followup not found' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Followup deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete followup' }, { status: 500 });
  }
}
