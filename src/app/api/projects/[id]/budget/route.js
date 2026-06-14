import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

// Recompute actual (paid expenses) and committed (open commitments) from source
// tables so the budget always reflects reality, then derive status.
async function recompute(projectId) {
  const [{ rows: a }, { rows: c }, { rows: f }] = await Promise.all([
    query(`SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE project_id=$1`, [projectId]),
    query(`SELECT COALESCE(SUM(amount),0) AS v FROM commitments WHERE project_id=$1 AND status='open'`, [projectId]),
    query(`SELECT COALESCE(SUM(amount),0) AS v FROM funding_sources WHERE project_id=$1`, [projectId]),
  ]);
  const actual = Number(a[0].v), committed = Number(c[0].v), fundingTotal = Number(f[0].v);

  const { rows } = await query(`SELECT * FROM project_budgets WHERE project_id=$1`, [projectId]);
  if (rows[0]) {
    // forecast defaults to actual+committed unless it was set higher manually
    const forecast = Math.max(Number(rows[0].forecast_amount) || 0, actual + committed);
    await query(
      `UPDATE project_budgets SET actual_amount=$1, committed_amount=$2, forecast_amount=$3, updated_at=now()
       WHERE project_id=$4`, [actual, committed, forecast, projectId]);
    await query(`SELECT fn_budget_status($1)`, [projectId]).catch(() => {});
  }
  return { actual, committed, fundingTotal };
}

// GET /api/projects/[id]/budget
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const gate = await assertProjectAccess(perm.auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  const { actual, committed, fundingTotal } = await recompute(id);
  const [{ rows: b }, { rows: fs }] = await Promise.all([
    query(`SELECT * FROM project_budgets WHERE project_id=$1`, [id]),
    query(`SELECT * FROM funding_sources WHERE project_id=$1 ORDER BY created_at`, [id]),
  ]);
  const budget = b[0] || null;
  const allocated = Number(budget?.allocated_amount) || 0;
  const forecast = Number(budget?.forecast_amount) || actual + committed;
  return NextResponse.json({
    success: true,
    data: {
      budget, funding_sources: fs,
      computed: {
        allocated, committed, actual, forecast, funding_total: fundingTotal,
        remaining: allocated - actual,
        variance: allocated - forecast,
        status: budget?.status || null,
      },
    },
  });
}

// PUT /api/projects/[id]/budget — upsert allocation/forecast/freeze, derive status
export async function PUT(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const b = await request.json();
    const allocated = Number(b.allocated_amount) || 0;
    const forecast = b.forecast_amount != null ? Number(b.forecast_amount) : null;
    const currency = b.currency || 'UGX';
    const margin = b.margin_band != null ? Number(b.margin_band) : 10;
    const isFrozen = !!b.is_frozen;

    await query(
      `INSERT INTO project_budgets (project_id, allocated_amount, forecast_amount, currency, margin_band, is_frozen, freeze_reason, frozen_by, created_by)
       VALUES ($1,$2,COALESCE($3,0),$4,$5,$6,$7,$8,$9)
       ON CONFLICT (project_id) DO UPDATE SET
         allocated_amount=EXCLUDED.allocated_amount,
         forecast_amount=COALESCE($3, project_budgets.forecast_amount),
         currency=EXCLUDED.currency, margin_band=EXCLUDED.margin_band,
         is_frozen=EXCLUDED.is_frozen, freeze_reason=EXCLUDED.freeze_reason,
         frozen_by=EXCLUDED.frozen_by, updated_at=now()`,
      [id, allocated, forecast, currency, margin, isFrozen, b.freeze_reason || null,
       isFrozen ? auth.userId : null, auth.userId]
    );
    await recompute(id); // also runs fn_budget_status
    const { rows } = await query(`SELECT * FROM project_budgets WHERE project_id=$1`, [id]);
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[Budget] PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save budget' }, { status: 500 });
  }
}
