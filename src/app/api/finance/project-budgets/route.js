import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { projectVisibilityFilter } from '@/lib/project-access.js';

// GET /api/finance/project-budgets — read-only portfolio rollup of project
// budgets (distinct from company/overhead `budgets`). This is the bridge that
// makes project budgets visible inside Finance.
export async function GET(request) {
  const perm = await requirePermission(request, 'budgets', 'view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const vis = projectVisibilityFilter(auth);
    const rows = (await query(
      `SELECT p.id, p.code, p.name, p.status AS project_status, p.currency,
              pb.allocated_amount, pb.actual_amount, pb.committed_amount, pb.forecast_amount,
              pb.status AS budget_status,
              (pb.allocated_amount - pb.actual_amount) AS remaining,
              (pb.allocated_amount - pb.forecast_amount) AS variance
       FROM projects p JOIN project_budgets pb ON pb.project_id = p.id
       WHERE 1=1 ${vis.clause}
       ORDER BY p.created_at DESC`, vis.params)).rows;

    const totals = rows.reduce((t, r) => ({
      allocated: t.allocated + Number(r.allocated_amount),
      actual: t.actual + Number(r.actual_amount),
      committed: t.committed + Number(r.committed_amount),
      forecast: t.forecast + Number(r.forecast_amount),
    }), { allocated: 0, actual: 0, committed: 0, forecast: 0 });
    totals.variance = totals.allocated - totals.forecast;

    return NextResponse.json({ success: true, data: { rows, totals } });
  } catch (error) {
    console.error('[Finance/project-budgets] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load project budgets' }, { status: 500 });
  }
}
