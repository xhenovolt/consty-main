import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { projectVisibilityFilter } from '@/lib/project-access.js';

// GET /api/dashboard/projects — real project-portfolio KPIs, scoped to the
// projects the caller can see (admins: all; others: their member projects).
export async function GET(request) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

  try {
    const vis = projectVisibilityFilter(auth);
    const projRows = (await query(
      `SELECT id, name, code, status, health, progress_pct, planned_end, actual_end
         FROM projects p WHERE 1=1 ${vis.clause}`, vis.params)).rows;

    const ids = projRows.map(r => r.id);
    const today = new Date().toISOString().slice(0, 10);

    // Portfolio counts (computed in JS from the project rows)
    const asDate = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : (d ? String(d).slice(0, 10) : null));
    const byStatus = {};
    let active = 0, delayed = 0, awaitingApproval = 0, nearCloseout = 0;
    const health = { green: 0, amber: 0, red: 0 };
    for (const p of projRows) {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      health[p.health] = (health[p.health] || 0) + 1;
      if (p.status === 'active') active++;
      if (p.status === 'planning') awaitingApproval++;
      const open = !['closed', 'cancelled'].includes(p.status);
      const pe = asDate(p.planned_end);
      if (open && pe && pe < today && Number(p.progress_pct) < 100) delayed++;
      if (p.status === 'closing' || Number(p.progress_pct) >= 95) nearCloseout++;
    }

    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: {
        portfolio: { total: 0, by_status: {}, active: 0, delayed: 0, stalled: 0, awaiting_approval: 0, near_closeout: 0 },
        health, budget: { allocated: 0, actual: 0, committed: 0, forecast: 0, variance: 0, deficit_count: 0, surplus_count: 0 },
        procurement: { pending_approval: 0, overdue: 0 }, resources: { shortage_count: 0, top_shortages: [] },
        blockers: { open_total: 0, top: [] }, work: { overdue_items: 0, upcoming_milestones: [] }, recent: [],
      } });
    }

    const A = [ids];
    const [stalled, budget, procurement, shortageCount, topShortages, openBlockers, topBlockers, overdueWork, milestones, recent] = await Promise.all([
      query(`SELECT count(DISTINCT project_id)::int n FROM blockers WHERE project_id=ANY($1::uuid[]) AND status<>'resolved' AND severity IN ('high','critical')`, A),
      query(`SELECT COALESCE(SUM(allocated_amount),0) allocated, COALESCE(SUM(actual_amount),0) actual,
                     COALESCE(SUM(committed_amount),0) committed, COALESCE(SUM(forecast_amount),0) forecast,
                     COUNT(*) FILTER (WHERE status IN ('deficit','overrun','frozen'))::int deficit_count,
                     COUNT(*) FILTER (WHERE status='surplus')::int surplus_count
              FROM project_budgets WHERE project_id=ANY($1::uuid[])`, A),
      query(`SELECT COUNT(*) FILTER (WHERE status='requested')::int pending_approval,
                     COUNT(*) FILTER (WHERE status IN ('requested','approved','ordered') AND needed_by < CURRENT_DATE)::int overdue
              FROM procurement_requests WHERE project_id=ANY($1::uuid[])`, A),
      query(`SELECT count(*)::int n FROM resources WHERE project_id=ANY($1::uuid[]) AND quantity_available < quantity_required`, A),
      query(`SELECT r.name, p.name AS project, (r.quantity_required - r.quantity_available) AS gap, r.unit_of_measure
              FROM resources r JOIN projects p ON p.id=r.project_id
              WHERE r.project_id=ANY($1::uuid[]) AND r.quantity_available < r.quantity_required
              ORDER BY gap DESC LIMIT 5`, A),
      query(`SELECT count(*)::int n FROM blockers WHERE project_id=ANY($1::uuid[]) AND status<>'resolved'`, A),
      query(`SELECT b.blocker_type, b.severity, b.description, p.name AS project
              FROM blockers b JOIN projects p ON p.id=b.project_id
              WHERE b.project_id=ANY($1::uuid[]) AND b.status<>'resolved'
              ORDER BY CASE b.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, b.detected_at DESC LIMIT 6`, A),
      query(`SELECT count(*)::int n FROM work_items WHERE project_id=ANY($1::uuid[]) AND status NOT IN ('done','cancelled') AND planned_end < CURRENT_DATE`, A),
      query(`SELECT wi.name, p.name AS project, wi.planned_end
              FROM work_items wi JOIN projects p ON p.id=wi.project_id
              WHERE wi.project_id=ANY($1::uuid[]) AND wi.type='milestone' AND wi.status<>'done'
                AND wi.planned_end >= CURRENT_DATE
              ORDER BY wi.planned_end LIMIT 6`, A),
      query(`SELECT id, name, code, status, health, progress_pct FROM projects
              WHERE id=ANY($1::uuid[]) ORDER BY updated_at DESC LIMIT 6`, A),
    ]);

    const b = budget.rows[0];
    return NextResponse.json({ success: true, data: {
      portfolio: { total: projRows.length, by_status: byStatus, active, delayed, stalled: stalled.rows[0].n, awaiting_approval: awaitingApproval, near_closeout: nearCloseout },
      health,
      budget: {
        allocated: Number(b.allocated), actual: Number(b.actual), committed: Number(b.committed), forecast: Number(b.forecast),
        variance: Number(b.allocated) - Number(b.forecast), deficit_count: b.deficit_count, surplus_count: b.surplus_count,
      },
      procurement: procurement.rows[0],
      resources: { shortage_count: shortageCount.rows[0].n, top_shortages: topShortages.rows },
      blockers: { open_total: openBlockers.rows[0].n, top: topBlockers.rows },
      work: { overdue_items: overdueWork.rows[0].n, upcoming_milestones: milestones.rows },
      recent: recent.rows,
    } });
  } catch (error) {
    console.error('[Dashboard/projects] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load dashboard' }, { status: 500 });
  }
}
