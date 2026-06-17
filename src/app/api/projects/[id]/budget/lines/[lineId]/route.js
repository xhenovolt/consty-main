import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

// PATCH /api/projects/[id]/budget/lines/[lineId] — change a category's allocation
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { id, lineId } = await params;
  const gate = await assertProjectAccess(perm.auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  try {
    const b = await request.json();
    if (b.allocated == null) return NextResponse.json({ success: false, error: 'allocated is required' }, { status: 400 });
    const { rows } = await query(
      `UPDATE budget_lines SET allocated=$1, updated_at=now() WHERE id=$2 AND project_id=$3 RETURNING *`,
      [Number(b.allocated) || 0, lineId, id]);
    if (!rows[0]) return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    await query(`SELECT fn_recompute_budget($1)`, [id]).catch(() => {});
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[BudgetLines] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update category' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/budget/lines/[lineId]
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { id, lineId } = await params;
  const gate = await assertProjectAccess(perm.auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  await query(`DELETE FROM budget_lines WHERE id=$1 AND project_id=$2`, [lineId, id]);
  await query(`SELECT fn_recompute_budget($1)`, [id]).catch(() => {});
  return NextResponse.json({ success: true });
}
