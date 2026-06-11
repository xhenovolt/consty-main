import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/prospects/[id]
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'prospects', 'view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const result = await query(
      `SELECT p.*, 
        (SELECT json_agg(pc.*) FROM prospect_contacts pc WHERE pc.prospect_id = p.id) as contacts,
        (SELECT json_agg(f.* ORDER BY f.scheduled_at DESC) FROM followups f WHERE f.prospect_id = p.id) as followups,
        (SELECT c.id FROM clients c WHERE c.prospect_id = p.id) as client_id
       FROM prospects p WHERE p.id = $1`, [id]
    );

    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Prospect not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Prospects] GET by id error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch prospect' }, { status: 500 });
  }
}

// PUT /api/prospects/[id]
export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'prospects', 'edit');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const body = await request.json();
    const fields = ['company_name','contact_name','email','phone','website','industry','source','stage','priority','estimated_value','estimated_value_text','currency','notes','tags','next_followup_date','next_followup_time','lost_reason','pipeline'];
    
    const updates = [];
    const values = [];
    fields.forEach(f => {
      if (body[f] !== undefined) {
        values.push(body[f]);
        updates.push(`${f} = $${values.length}`);
      }
    });

    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });

    // If stage changed to 'won', set converted_at
    if (body.stage === 'won') {
      updates.push(`converted_at = NOW()`);
    }

    values.push(id);
    const result = await query(`UPDATE prospects SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);

    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Prospect not found' }, { status: 404 });

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'UPDATE', 'prospect', id, JSON.stringify(body)]);

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Prospects] PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update prospect' }, { status: 500 });
  }
}

// DELETE /api/prospects/[id]
export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'prospects', 'delete');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const result = await query(`DELETE FROM prospects WHERE id = $1 RETURNING id, company_name`, [id]);

    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Prospect not found' }, { status: 404 });

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'DELETE', 'prospect', id, JSON.stringify({ company_name: result.rows[0].company_name })]);

    return NextResponse.json({ success: true, message: 'Prospect deleted' });
  } catch (error) {
    console.error('[Prospects] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete prospect' }, { status: 500 });
  }
}
