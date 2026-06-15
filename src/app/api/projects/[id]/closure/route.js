import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

// Live close-out figures derived from the project's actual data.
async function computeSummary(projectId) {
  const [cost, funding, issues, blockers, materials, assets] = await Promise.all([
    query(`SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE project_id=$1`, [projectId]),
    query(`SELECT COALESCE(SUM(amount),0) v FROM funding_sources WHERE project_id=$1`, [projectId]),
    query(`SELECT count(*)::int n FROM project_issues WHERE project_id=$1 AND status<>'resolved'`, [projectId]),
    query(`SELECT count(*)::int n FROM blockers WHERE project_id=$1 AND status<>'resolved'`, [projectId]),
    query(`SELECT COALESCE(json_agg(json_build_object('name',name,'qty',quantity_available,'unit',unit_of_measure))
            FILTER (WHERE quantity_available > 0),'[]') j
           FROM resources WHERE project_id=$1 AND category IN ('material','consumable','fuel','water','power')`, [projectId]),
    query(`SELECT COALESCE(json_agg(json_build_object('name',name,'returned',quantity_returned))
            FILTER (WHERE is_reusable AND quantity_returned > 0),'[]') j
           FROM resources WHERE project_id=$1`, [projectId]),
  ]);
  const finalCost = Number(cost.rows[0].v);
  const fundingTotal = Number(funding.rows[0].v);
  return {
    final_cost: finalCost,
    funding_total: fundingTotal,
    pnl_result: fundingTotal - finalCost,
    unresolved_issue_count: issues.rows[0].n + blockers.rows[0].n,
    remaining_materials: materials.rows[0].j,
    returned_assets: assets.rows[0].j,
  };
}

// GET /api/projects/[id]/closure — stored record + live computed summary
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const gate = await assertProjectAccess(perm.auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  const [stored, computed] = await Promise.all([
    query(`SELECT c.*, u.name AS accepted_by_name FROM project_closures c LEFT JOIN users u ON u.id = c.accepted_by WHERE c.project_id=$1`, [id]),
    computeSummary(id),
  ]);
  return NextResponse.json({ success: true, data: { closure: stored.rows[0] || null, computed } });
}

// PUT /api/projects/[id]/closure — upsert; accept=true records client sign-off and closes the project
export async function PUT(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const b = await request.json();
    const s = await computeSummary(id);
    const accept = b.accept === true;
    const status = accept ? 'closed' : 'in_progress';

    const { rows } = await query(
      `INSERT INTO project_closures
         (project_id, final_cost, remaining_materials, returned_assets, unresolved_issue_count,
          lessons_learned, pnl_result, status, client_accepted_at, accepted_by, created_by)
       VALUES ($1::uuid,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8,$9,$10::uuid,$11::uuid)
       ON CONFLICT (project_id) DO UPDATE SET
         final_cost=EXCLUDED.final_cost, remaining_materials=EXCLUDED.remaining_materials,
         returned_assets=EXCLUDED.returned_assets, unresolved_issue_count=EXCLUDED.unresolved_issue_count,
         lessons_learned=COALESCE(EXCLUDED.lessons_learned, project_closures.lessons_learned),
         pnl_result=EXCLUDED.pnl_result, status=EXCLUDED.status,
         client_accepted_at=COALESCE(EXCLUDED.client_accepted_at, project_closures.client_accepted_at),
         accepted_by=COALESCE(EXCLUDED.accepted_by, project_closures.accepted_by), updated_at=now()
       RETURNING *`,
      [id, s.final_cost, JSON.stringify(s.remaining_materials), JSON.stringify(s.returned_assets),
       s.unresolved_issue_count, b.lessons_learned || null, s.pnl_result, status,
       accept ? new Date().toISOString() : null, accept ? auth.userId : null, auth.userId]
    );

    if (accept) {
      await query(`UPDATE projects SET status='closed', actual_end=COALESCE(actual_end, CURRENT_DATE), updated_at=now() WHERE id=$1`, [id]);
      await query(`SELECT fn_project_health($1)`, [id]).catch(() => {});
    }
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[Closure] PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save closure' }, { status: 500 });
  }
}
