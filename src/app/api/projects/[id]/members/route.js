import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

const VALID_ROLES = ['governor','manager','stage_leader','contributor','viewer','contractor',
                     'client','accountant','procurement_officer','storekeeper','inspector','field_worker'];

// GET /api/projects/[id]/members
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  const result = await query(
    `SELECT pm.id, pm.user_id, pm.project_role, pm.stage_id, pm.status,
            u.name AS user_name, u.email AS user_email
     FROM project_members pm JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1 AND pm.status = 'active' ORDER BY pm.created_at`, [id]
  );
  return NextResponse.json({ success: true, data: result.rows });
}

// POST /api/projects/[id]/members — add (governor/manager or global admin)
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { manageMembers: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const { user_id, project_role, stage_id } = await request.json();
    if (!user_id || !project_role)
      return NextResponse.json({ success: false, error: 'user_id and project_role are required' }, { status: 400 });
    if (!VALID_ROLES.includes(project_role))
      return NextResponse.json({ success: false, error: 'Invalid project_role' }, { status: 400 });

    const result = await query(
      `INSERT INTO project_members (project_id, user_id, project_role, stage_id, created_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (project_id, user_id, project_role)
       DO UPDATE SET status = 'active', stage_id = EXCLUDED.stage_id, updated_at = now()
       RETURNING *`,
      [id, user_id, project_role, stage_id || null, auth.userId]
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[ProjectMembers] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to add member' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/members?memberId=... — soft-remove
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { manageMembers: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  const memberId = new URL(request.url).searchParams.get('memberId');
  if (!memberId) return NextResponse.json({ success: false, error: 'memberId is required' }, { status: 400 });
  await query(`UPDATE project_members SET status='removed', updated_at=now() WHERE id=$1 AND project_id=$2`,
    [memberId, id]);
  return NextResponse.json({ success: true });
}
