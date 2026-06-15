import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

const RESULTS = ['pending','pass','fail','conditional'];

// GET /api/projects/[id]/inspections
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const gate = await assertProjectAccess(perm.auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  const { rows } = await query(
    `SELECT ins.*, u.name AS inspector_name, wi.name AS work_item_name
     FROM inspections ins LEFT JOIN users u ON u.id = ins.inspector_id LEFT JOIN work_items wi ON wi.id = ins.work_item_id
     WHERE ins.project_id = $1 ORDER BY COALESCE(ins.performed_at, ins.created_at) DESC`, [id]);
  return NextResponse.json({ success: true, data: rows });
}

// POST /api/projects/[id]/inspections
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  try {
    const b = await request.json();
    const result = b.result && RESULTS.includes(b.result) ? b.result : 'pending';
    const { rows } = await query(
      `INSERT INTO inspections (project_id, work_item_id, inspector_id, result, notes, performed_at)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6)
       RETURNING *`,
      [id, b.work_item_id || null, result === 'pending' ? null : auth.userId, result, b.notes || null,
       result === 'pending' ? null : new Date().toISOString()]);
    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Inspections] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to record inspection' }, { status: 500 });
  }
}
