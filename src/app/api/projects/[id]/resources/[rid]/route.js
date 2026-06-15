import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

// PATCH /api/projects/[id]/resources/[rid]
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { id, rid } = await params;
  const gate = await assertProjectAccess(perm.auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const b = await request.json();
    const ALLOWED = ['name','type','unit_of_measure','size','mass_kg','quantity_required','unit_cost',
                     'currency','condition','manufacturer','supplier_id','source','storage_location',
                     'is_reusable','notes'];
    const sets = [], values = [];
    for (const k of ALLOWED) if (k in b) { values.push(b[k]); sets.push(`${k} = $${values.length}`); }
    if ('attributes' in b) { values.push(JSON.stringify(b.attributes)); sets.push(`attributes = $${values.length}::jsonb`); }
    if (sets.length === 0) return NextResponse.json({ success: false, error: 'No editable fields provided' }, { status: 400 });
    values.push(rid); values.push(id);
    const { rows } = await query(
      `UPDATE resources SET ${sets.join(', ')}, updated_at = now()
        WHERE id = $${values.length - 1} AND project_id = $${values.length} RETURNING *`, values);
    if (!rows[0]) return NextResponse.json({ success: false, error: 'Resource not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[Resources] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update resource' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/resources/[rid]
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { id, rid } = await params;
  const gate = await assertProjectAccess(perm.auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  await query(`DELETE FROM resources WHERE id = $1 AND project_id = $2`, [rid, id]);
  return NextResponse.json({ success: true });
}
