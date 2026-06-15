import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

// GET /api/projects/[id]/risks — open first, highest score first
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const gate = await assertProjectAccess(perm.auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  const { rows } = await query(
    `SELECT r.*, u.name AS owner_name FROM risks r LEFT JOIN users u ON u.id = r.owner_id
     WHERE r.project_id = $1 ORDER BY (r.status IN ('closed')), r.score DESC, r.created_at DESC`, [id]);
  return NextResponse.json({ success: true, data: rows });
}

// POST /api/projects/[id]/risks
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
      `INSERT INTO risks (project_id, description, probability, impact, mitigation_plan, owner_id, created_by)
       VALUES ($1::uuid,$2,COALESCE($3,3),COALESCE($4,3),$5,$6::uuid,$7::uuid) RETURNING *`,
      [id, b.description, b.probability ?? null, b.impact ?? null, b.mitigation_plan || null, b.owner_id || null, auth.userId]);
    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Risks] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create risk' }, { status: 500 });
  }
}
