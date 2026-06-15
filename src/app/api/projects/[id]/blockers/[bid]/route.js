import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

// PATCH /api/projects/[id]/blockers/[bid] — update status / fields
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { id, bid } = await params;
  const gate = await assertProjectAccess(perm.auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const b = await request.json();
    const ALLOWED = ['status','severity','description','required_action','responsible_user_id',
                     'est_delay_days','est_cost_impact','resolution_notes','blocker_type','target_type'];
    const sets = [], values = [];
    for (const k of ALLOWED) if (k in b) { values.push(b[k]); sets.push(`${k} = $${values.length}`); }
    if (b.status === 'resolved') sets.push(`resolved_at = now()`);
    if (sets.length === 0) return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    values.push(bid); values.push(id);
    const { rows } = await query(
      `UPDATE blockers SET ${sets.join(', ')}, updated_at = now()
        WHERE id = $${values.length - 1} AND project_id = $${values.length} RETURNING *`, values);
    if (!rows[0]) return NextResponse.json({ success: false, error: 'Blocker not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[Blockers] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update blocker' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/blockers/[bid]
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { id, bid } = await params;
  const gate = await assertProjectAccess(perm.auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  await query(`DELETE FROM blockers WHERE id = $1 AND project_id = $2`, [bid, id]);
  return NextResponse.json({ success: true });
}
