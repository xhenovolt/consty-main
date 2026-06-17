import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

// GET /api/projects/[id]/procurement — list requests with line + receipt counts
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const gate = await assertProjectAccess(perm.auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  const { rows } = await query(
    `SELECT pr.*, s.name AS supplier_name,
       (SELECT COUNT(*) FROM procurement_request_lines l WHERE l.request_id = pr.id) AS line_count,
       (SELECT COUNT(*) FROM goods_receipts g WHERE g.procurement_request_id = pr.id) AS receipt_count
     FROM procurement_requests pr LEFT JOIN suppliers s ON s.id = pr.supplier_id
     WHERE pr.project_id = $1 ORDER BY pr.created_at DESC`, [id]);
  return NextResponse.json({ success: true, data: rows });
}

// POST /api/projects/[id]/procurement — create request + lines; total from lines
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const b = await request.json();
    if (!b.title) return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });
    // Each line needs at least an item name.
    const lines = Array.isArray(b.lines) ? b.lines.filter(l => l && (l.item_name || l.description)) : [];
    const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.est_unit_cost) || 0), 0);

    const { rows } = await query(
      `INSERT INTO procurement_requests
         (project_id, work_item_id, title, reason, budget_category, supplier_id, total_est_cost, currency, needed_by, requested_by, notes)
       VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::uuid,$7,COALESCE($8,'UGX'),$9::date,$10::uuid,$11)
       RETURNING *`,
      [id, b.work_item_id || null, b.title, b.reason || null, b.budget_category || null, b.supplier_id || null,
       total, b.currency || null, b.needed_by || null, auth.userId, b.notes || null]
    );
    const pr = rows[0];

    for (const l of lines) {
      await query(
        `INSERT INTO procurement_request_lines
           (request_id, item_name, specification, quantity, unit, est_unit_cost, supplier_name, supplier_id, budget_category, description)
         VALUES ($1::uuid,$2,$3,COALESCE($4,0),$5,COALESCE($6,0),$7,$8::uuid,COALESCE($9,$10),$11)`,
        [pr.id, l.item_name || l.description || 'Item', l.specification || null, l.quantity ?? null, l.unit || null,
         l.est_unit_cost ?? null, l.supplier_name || null, l.supplier_id || null, l.budget_category || null,
         b.budget_category || null, l.notes || null]
      );
    }
    return NextResponse.json({ success: true, data: pr }, { status: 201 });
  } catch (error) {
    console.error('[Procurement] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create request' }, { status: 500 });
  }
}
