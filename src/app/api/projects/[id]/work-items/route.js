import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

const TYPES = ['stage','milestone','work_package','task','subtask'];

// GET /api/projects/[id]/work-items — flat list (client builds the tree)
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  const result = await query(
    `SELECT wi.*, ow.name AS owner_name
     FROM work_items wi LEFT JOIN users ow ON ow.id = wi.owner_id
     WHERE wi.project_id = $1 ORDER BY wi.sequence, wi.created_at`, [id]
  );
  return NextResponse.json({ success: true, data: result.rows });
}

// POST /api/projects/[id]/work-items — create a node, then roll up
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const b = await request.json();
    if (!b.name || !b.type) return NextResponse.json({ success: false, error: 'name and type are required' }, { status: 400 });
    if (!TYPES.includes(b.type)) return NextResponse.json({ success: false, error: 'Invalid work item type' }, { status: 400 });

    // parent must belong to the same project
    if (b.parent_id) {
      const parent = await query(`SELECT id FROM work_items WHERE id=$1 AND project_id=$2`, [b.parent_id, id]);
      if (!parent.rows[0]) return NextResponse.json({ success: false, error: 'parent not in this project' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO work_items
         (project_id, type, parent_id, name, description, owner_id, status, priority,
          planned_start, planned_end, weight, is_gate, budget_amount, sequence, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'not_started'),COALESCE($8,'medium'),
               $9,$10,COALESCE($11,1),COALESCE($12,false),$13,COALESCE($14,0),$15)
       RETURNING *`,
      [id, b.type, b.parent_id || null, b.name, b.description || null, b.owner_id || null,
       b.status || null, b.priority || null, b.planned_start || null, b.planned_end || null,
       b.weight ?? null, b.is_gate ?? null, b.budget_amount ?? null, b.sequence ?? null, auth.userId]
    );
    await query(`SELECT fn_rollup_project($1)`, [id]);
    await query(`SELECT fn_project_health($1)`, [id]).catch(() => {});
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[WorkItems] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create work item' }, { status: 500 });
  }
}
