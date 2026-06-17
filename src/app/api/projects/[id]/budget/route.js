import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

// GET /api/projects/[id]/budget — derived from category lines via fn_recompute_budget
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const gate = await assertProjectAccess(perm.auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  await query(`SELECT fn_recompute_budget($1)`, [id]).catch(() => {});
  const [{ rows: b }, { rows: lines }, { rows: fs }, { rows: fund }] = await Promise.all([
    query(`SELECT * FROM project_budgets WHERE project_id=$1`, [id]),
    query(`SELECT *, (allocated - actual) AS remaining, (allocated - forecast) AS variance
             FROM budget_lines WHERE project_id=$1 ORDER BY category`, [id]),
    query(`SELECT * FROM funding_sources WHERE project_id=$1 ORDER BY created_at`, [id]),
    query(`SELECT COALESCE(SUM(amount),0) v FROM funding_sources WHERE project_id=$1`, [id]),
  ]);
  const budget = b[0] || null;
  const allocated = Number(budget?.allocated_amount) || 0;
  const actual = Number(budget?.actual_amount) || 0;
  const committed = Number(budget?.committed_amount) || 0;
  const forecast = Number(budget?.forecast_amount) || 0;
  return NextResponse.json({
    success: true,
    data: {
      budget, categories: lines, funding_sources: fs,
      computed: {
        allocated, committed, actual, forecast, funding_total: Number(fund[0].v),
        available: allocated - committed,   // Allocated − Committed
        remaining: allocated - actual,      // Allocated − Actual
        variance: allocated - forecast,
        status: budget?.status || null,
      },
    },
  });
}

// PUT /api/projects/[id]/budget — freeze / currency only (allocation is per category)
export async function PUT(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const b = await request.json();
    const isFrozen = !!b.is_frozen;
    await query(
      `INSERT INTO project_budgets (project_id, currency, is_frozen, freeze_reason, frozen_by, created_by)
       VALUES ($1,COALESCE($2,'UGX'),$3,$4,$5,$6)
       ON CONFLICT (project_id) DO UPDATE SET
         currency=COALESCE($2, project_budgets.currency),
         is_frozen=$3, freeze_reason=$4, frozen_by=$5, updated_at=now()`,
      [id, b.currency || null, isFrozen, b.freeze_reason || null, isFrozen ? auth.userId : null, auth.userId]
    );
    await query(`SELECT fn_recompute_budget($1)`, [id]).catch(() => {});
    const { rows } = await query(`SELECT * FROM project_budgets WHERE project_id=$1`, [id]);
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[Budget] PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save budget' }, { status: 500 });
  }
}
