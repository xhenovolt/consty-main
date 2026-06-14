import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

// GET /api/projects/[id] — project + members + work-item tree + counts
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;

  const gate = await assertProjectAccess(auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const [proj, members, items] = await Promise.all([
      query(
        `SELECT p.*, gov.name AS governor_name, mgr.name AS manager_name, cl.company_name AS client_name,
           (SELECT json_build_object(
              'allocated', pb.allocated_amount, 'actual', pb.actual_amount,
              'forecast', pb.forecast_amount, 'committed', pb.committed_amount, 'status', pb.status)
            FROM project_budgets pb WHERE pb.project_id = p.id) AS budget
         FROM projects p
         LEFT JOIN users gov ON gov.id = p.governor_id
         LEFT JOIN users mgr ON mgr.id = p.manager_id
         LEFT JOIN clients cl ON cl.id = p.client_id
         WHERE p.id = $1`, [id]),
      query(
        `SELECT pm.id, pm.user_id, pm.project_role, pm.status, u.name AS user_name, u.email AS user_email
         FROM project_members pm JOIN users u ON u.id = pm.user_id
         WHERE pm.project_id = $1 AND pm.status = 'active'
         ORDER BY pm.created_at`, [id]),
      query(
        `SELECT wi.*, ow.name AS owner_name
         FROM work_items wi LEFT JOIN users ow ON ow.id = wi.owner_id
         WHERE wi.project_id = $1
         ORDER BY wi.sequence, wi.created_at`, [id]),
    ]);

    if (!proj.rows[0]) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    return NextResponse.json({
      success: true,
      data: { ...proj.rows[0], members: members.rows, work_items: items.rows, access: gate.access },
    });
  } catch (error) {
    console.error('[Projects] GET[id] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch project' }, { status: 500 });
  }
}

// PATCH /api/projects/[id] — update editable fields; recompute health
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;

  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const body = await request.json();
    const ALLOWED = ['name','description','category','type','status','priority','currency','location',
                     'governor_id','manager_id','client_id','planned_start','planned_end','actual_start','actual_end'];
    const sets = [], values = [];
    for (const k of ALLOWED) {
      if (k in body) { values.push(body[k]); sets.push(`${k} = $${values.length}`); }
    }
    if (sets.length === 0) return NextResponse.json({ success: false, error: 'No editable fields provided' }, { status: 400 });
    values.push(id);
    const result = await query(
      `UPDATE projects SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    await query(`SELECT fn_project_health($1)`, [id]).catch(() => {});
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Projects] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/projects/[id] — admin/global only (projects.delete)
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'delete');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  // Membership-gated: only global admins reach delete in practice; still gate.
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  try {
    await query(`DELETE FROM projects WHERE id = $1`, [id]);
    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                 VALUES ($1,'DELETE','project',$2,'{}')`, [auth.userId, id]).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Projects] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete project' }, { status: 500 });
  }
}
