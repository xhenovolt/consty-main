import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

// GET /api/projects/[id]/defects
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const gate = await assertProjectAccess(perm.auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  const { rows } = await query(
    `SELECT d.*, u.name AS assigned_name, wi.name AS work_item_name
     FROM defects d LEFT JOIN users u ON u.id = d.assigned_to LEFT JOIN work_items wi ON wi.id = d.work_item_id
     WHERE d.project_id = $1 ORDER BY (d.status = 'closed'),
       CASE d.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, d.created_at DESC`, [id]);
  return NextResponse.json({ success: true, data: rows });
}

// POST /api/projects/[id]/defects  (rework_required defects feed blocker diagnosis)
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  try {
    const b = await request.json();
    if (!b.description) return NextResponse.json({ success: false, error: 'description is required' }, { status: 400 });
    const { rows } = await query(
      `INSERT INTO defects (project_id, work_item_id, inspection_id, description, severity, rework_required, assigned_to, created_by)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4,COALESCE($5,'medium'),COALESCE($6,false),$7::uuid,$8::uuid) RETURNING *`,
      [id, b.work_item_id || null, b.inspection_id || null, b.description, b.severity || null,
       b.rework_required ?? null, b.assigned_to || null, auth.userId]);
    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Defects] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create defect' }, { status: 500 });
  }
}
