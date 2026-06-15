import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

const TYPES = ['missing_budget','missing_material','missing_sister_material','unavailable_labour',
  'unavailable_equipment','transport_delay','supplier_delay','approval_delay','client_delay',
  'design_document_issue','weather_external','quality_defect','rework_required','scope_change','unclear_responsibility'];

// GET /api/projects/[id]/blockers — list (open first, then by severity)
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const gate = await assertProjectAccess(perm.auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  const { rows } = await query(
    `SELECT b.*, u.name AS responsible_name
     FROM blockers b LEFT JOIN users u ON u.id = b.responsible_user_id
     WHERE b.project_id = $1
     ORDER BY (b.status = 'resolved'),
              CASE b.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
              b.detected_at DESC`, [id]);
  return NextResponse.json({ success: true, data: rows });
}

// POST /api/projects/[id]/blockers — manual blocker
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const b = await request.json();
    if (!b.blocker_type || !TYPES.includes(b.blocker_type))
      return NextResponse.json({ success: false, error: 'Valid blocker_type is required' }, { status: 400 });
    const { rows } = await query(
      `INSERT INTO blockers
         (project_id, target_type, target_id, blocker_type, description, responsible_user_id,
          required_action, est_delay_days, est_cost_impact, severity, detected_by, created_by)
       VALUES ($1::uuid,COALESCE($2,'project'),$3::uuid,$4,$5,$6::uuid,$7,$8,$9,COALESCE($10,'medium'),'manual',$11::uuid)
       RETURNING *`,
      [id, b.target_type || null, b.target_id || null, b.blocker_type, b.description || null,
       b.responsible_user_id || null, b.required_action || null, b.est_delay_days ?? null,
       b.est_cost_impact ?? null, b.severity || null, auth.userId]
    );
    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Blockers] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create blocker' }, { status: 500 });
  }
}
