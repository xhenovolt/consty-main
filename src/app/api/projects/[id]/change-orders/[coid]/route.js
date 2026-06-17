import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

const STATUSES = ['draft','submitted','approved','rejected'];

// PATCH /api/projects/[id]/change-orders/[coid]
// Approving applies the change: budget allocated += cost_impact, planned_end += time_impact_days.
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id, coid } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const cur = (await query(`SELECT * FROM change_orders WHERE id=$1 AND project_id=$2`, [coid, id])).rows[0];
    if (!cur) return NextResponse.json({ success: false, error: 'Change order not found' }, { status: 404 });

    const b = await request.json();
    const sets = [], values = [];
    if (b.status != null) {
      if (!STATUSES.includes(b.status)) return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
      values.push(b.status); sets.push(`status = $${values.length}`);
      if (b.status === 'approved') { values.push(auth.userId); sets.push(`approved_by = $${values.length}::uuid`); sets.push(`approved_at = now()`); }
    }
    for (const k of ['title','reason','original_scope','requested_change','cost_impact','time_impact_days']) {
      if (k in b) { values.push(b[k]); sets.push(`${k} = $${values.length}`); }
    }
    if (sets.length === 0) return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    values.push(coid); values.push(id);
    const { rows } = await query(
      `UPDATE change_orders SET ${sets.join(', ')}, updated_at = now()
        WHERE id = $${values.length - 1} AND project_id = $${values.length} RETURNING *`, values);
    const co = rows[0];

    // Apply the change exactly once, on the draft/submitted → approved transition.
    if (b.status === 'approved' && cur.status !== 'approved') {
      const cost = Number(co.cost_impact) || 0;
      const days = Number(co.time_impact_days) || 0;
      if (cost !== 0) {
        // Apply the cost change to the contingency budget line, then recompute.
        await query(`INSERT INTO project_budgets (project_id) VALUES ($1) ON CONFLICT (project_id) DO NOTHING`, [id]);
        await query(
          `INSERT INTO budget_lines (project_id, category, allocated) VALUES ($1::uuid,'contingency',GREATEST($2,0))
           ON CONFLICT (project_id, category) DO UPDATE SET allocated = GREATEST(budget_lines.allocated + $2, 0), updated_at=now()`,
          [id, cost]).catch(() => {});
        await query(`SELECT fn_recompute_budget($1)`, [id]).catch(() => {});
      }
      if (days !== 0) {
        await query(
          `UPDATE projects SET planned_end = planned_end + ($2 || ' days')::interval, updated_at = now()
            WHERE id = $1 AND planned_end IS NOT NULL`, [id, days]).catch(() => {});
        await query(`SELECT fn_project_health($1)`, [id]).catch(() => {});
      }
    }
    return NextResponse.json({ success: true, data: co });
  } catch (error) {
    console.error('[ChangeOrders] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update change order' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/change-orders/[coid]
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { id, coid } = await params;
  const gate = await assertProjectAccess(perm.auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  await query(`DELETE FROM change_orders WHERE id = $1 AND project_id = $2`, [coid, id]);
  return NextResponse.json({ success: true });
}
