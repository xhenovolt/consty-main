import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

const CATEGORIES = ['materials', 'labour', 'transport', 'equipment', 'permits', 'subcontractors', 'contingency', 'other'];

// POST /api/projects/[id]/budget/lines — allocate a category (upsert)
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const b = await request.json();
    if (!CATEGORIES.includes(b.category)) return NextResponse.json({ success: false, error: 'Invalid category' }, { status: 400 });
    const allocated = Number(b.allocated) || 0;
    await query(`INSERT INTO project_budgets (project_id) VALUES ($1) ON CONFLICT (project_id) DO NOTHING`, [id]);
    const { rows } = await query(
      `INSERT INTO budget_lines (project_id, category, allocated, currency)
       VALUES ($1::uuid,$2,$3,COALESCE($4,'UGX'))
       ON CONFLICT (project_id, category) DO UPDATE SET allocated=EXCLUDED.allocated, updated_at=now()
       RETURNING *`, [id, b.category, allocated, b.currency || null]);
    await query(`SELECT fn_recompute_budget($1)`, [id]).catch(() => {});
    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[BudgetLines] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save category' }, { status: 500 });
  }
}
