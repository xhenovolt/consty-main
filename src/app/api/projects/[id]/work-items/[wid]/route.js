import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

// PATCH /api/projects/[id]/work-items/[wid] — update + roll up progress
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id, wid } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const b = await request.json();
    const ALLOWED = ['name','description','owner_id','status','priority','planned_start','planned_end',
                     'actual_start','actual_end','progress_pct','weight','is_gate','budget_amount',
                     'sequence','completion_notes'];
    const sets = [], values = [];
    for (const k of ALLOWED) if (k in b) { values.push(b[k]); sets.push(`${k} = $${values.length}`); }

    // Completing a leaf snaps progress to 100 unless explicitly provided.
    if (b.status === 'done' && !('progress_pct' in b)) { values.push(100); sets.push(`progress_pct = $${values.length}`); }

    if (sets.length === 0) return NextResponse.json({ success: false, error: 'No editable fields provided' }, { status: 400 });
    values.push(wid); values.push(id);
    const result = await query(
      `UPDATE work_items SET ${sets.join(', ')}, updated_at = now()
        WHERE id = $${values.length - 1} AND project_id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Work item not found' }, { status: 404 });

    await query(`SELECT fn_rollup_project($1)`, [id]);
    await query(`SELECT fn_project_health($1)`, [id]).catch(() => {});
    const fresh = await query(`SELECT * FROM work_items WHERE id = $1`, [wid]);
    return NextResponse.json({ success: true, data: fresh.rows[0] });
  } catch (error) {
    console.error('[WorkItems] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update work item' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/work-items/[wid] — delete subtree (cascade) + roll up
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id, wid } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  await query(`DELETE FROM work_items WHERE id = $1 AND project_id = $2`, [wid, id]);
  await query(`SELECT fn_rollup_project($1)`, [id]);
  await query(`SELECT fn_project_health($1)`, [id]).catch(() => {});
  return NextResponse.json({ success: true });
}
