import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

// GET /api/projects/[id]/change-orders
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const gate = await assertProjectAccess(perm.auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  const { rows } = await query(
    `SELECT co.*, ru.name AS requested_by_name, au.name AS approved_by_name
     FROM change_orders co LEFT JOIN users ru ON ru.id = co.requested_by LEFT JOIN users au ON au.id = co.approved_by
     WHERE co.project_id = $1 ORDER BY co.created_at DESC`, [id]);
  return NextResponse.json({ success: true, data: rows });
}

// POST /api/projects/[id]/change-orders
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
    const { rows } = await query(
      `INSERT INTO change_orders
         (project_id, title, reason, original_scope, requested_change, cost_impact, time_impact_days, status, requested_by)
       VALUES ($1::uuid,$2,$3,$4,$5,COALESCE($6,0),COALESCE($7,0),'draft',$8::uuid) RETURNING *`,
      [id, b.title, b.reason || null, b.original_scope || null, b.requested_change || null,
       b.cost_impact ?? null, b.time_impact_days ?? null, auth.userId]);
    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[ChangeOrders] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create change order' }, { status: 500 });
  }
}
