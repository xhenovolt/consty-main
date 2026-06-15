import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

// GET /api/projects/[id]/issues
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const gate = await assertProjectAccess(perm.auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  const { rows } = await query(
    `SELECT i.*, u.name AS owner_name FROM project_issues i LEFT JOIN users u ON u.id = i.owner_id
     WHERE i.project_id = $1 ORDER BY (i.status = 'resolved'), i.due_date NULLS LAST, i.created_at DESC`, [id]);
  return NextResponse.json({ success: true, data: rows });
}

// POST /api/projects/[id]/issues
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
      `INSERT INTO project_issues (project_id, description, current_impact, owner_id, resolution_plan, due_date, created_by)
       VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6::date,$7::uuid) RETURNING *`,
      [id, b.description, b.current_impact || null, b.owner_id || null, b.resolution_plan || null, b.due_date || null, auth.userId]);
    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Issues] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create issue' }, { status: 500 });
  }
}
