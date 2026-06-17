import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

// Refresh the project budget's actual spend (sum of project expenses) and status.
async function refreshActual(projectId) {
  await query(
    `UPDATE project_budgets SET
       actual_amount = (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE project_id=$1),
       updated_at = now()
     WHERE project_id = $1`, [projectId]).catch(() => {});
  await query(`SELECT fn_budget_status($1)`, [projectId]).catch(() => {});
}

// GET /api/projects/[id]/expenses
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const gate = await assertProjectAccess(perm.auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  const { rows } = await query(
    `SELECT e.*, wi.name AS work_item_name
     FROM expenses e LEFT JOIN work_items wi ON wi.id = e.work_item_id
     WHERE e.project_id = $1 ORDER BY e.expense_date DESC NULLS LAST, e.created_at DESC`, [id]);
  return NextResponse.json({ success: true, data: rows });
}

// POST /api/projects/[id]/expenses — log a project-scoped expense
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  try {
    const b = await request.json();
    const amount = Number(b.amount);
    if (!(amount > 0)) return NextResponse.json({ success: false, error: 'A positive amount is required' }, { status: 400 });

    // expenses.account_id is required (company ledger). Resolve one: explicit →
    // a project funding-source account → the first company account.
    let accountId = b.account_id || null;
    if (!accountId) {
      accountId = (await query(
        `SELECT account_id FROM funding_sources WHERE project_id=$1 AND account_id IS NOT NULL ORDER BY created_at LIMIT 1`, [id]
      )).rows[0]?.account_id || null;
    }
    if (!accountId) {
      accountId = (await query(`SELECT id FROM accounts ORDER BY created_at LIMIT 1`)).rows[0]?.id || null;
    }
    if (!accountId) return NextResponse.json({ success: false, error: 'No finance account exists to record this expense. Create one in Finance → Accounts first.' }, { status: 400 });

    const { rows } = await query(
      `INSERT INTO expenses
         (project_id, work_item_id, budget_id, account_id, amount, currency, category, vendor, description, expense_date, status, created_by)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,COALESCE($6,'UGX'),$7,$8,$9,COALESCE($10::date,CURRENT_DATE),COALESCE($11,'paid'),$12::uuid)
       RETURNING *`,
      [id, b.work_item_id || null, b.budget_line_id || null, accountId, amount, b.currency || null,
       b.category || 'general', b.vendor || null, b.description || b.category || 'Project expense',
       b.expense_date || null, b.status || null, auth.userId]
    );
    await refreshActual(id);
    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[ProjectExpenses] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to log expense' }, { status: 500 });
  }
}
