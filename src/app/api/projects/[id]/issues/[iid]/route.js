import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { id, iid } = await params;
  const gate = await assertProjectAccess(perm.auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  try {
    const b = await request.json();
    const ALLOWED = ['description','current_impact','owner_id','resolution_plan','due_date','status'];
    const sets = [], values = [];
    for (const k of ALLOWED) if (k in b) { values.push(b[k]); sets.push(`${k} = $${values.length}`); }
    if (sets.length === 0) return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    values.push(iid); values.push(id);
    const { rows } = await query(
      `UPDATE project_issues SET ${sets.join(', ')}, updated_at = now()
        WHERE id = $${values.length - 1} AND project_id = $${values.length} RETURNING *`, values);
    if (!rows[0]) return NextResponse.json({ success: false, error: 'Issue not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[Issues] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update issue' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { id, iid } = await params;
  const gate = await assertProjectAccess(perm.auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  await query(`DELETE FROM project_issues WHERE id = $1 AND project_id = $2`, [iid, id]);
  return NextResponse.json({ success: true });
}
