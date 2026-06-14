import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

const SOURCE_TYPES = ['company_wallet','client_deposit','external_funder','loan','grant','donor','retained_earnings','manual_external'];

// GET /api/projects/[id]/funding
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const gate = await assertProjectAccess(perm.auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  const { rows } = await query(`SELECT * FROM funding_sources WHERE project_id=$1 ORDER BY created_at`, [id]);
  return NextResponse.json({ success: true, data: rows });
}

// POST /api/projects/[id]/funding
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const b = await request.json();
    if (!b.source_type || !SOURCE_TYPES.includes(b.source_type))
      return NextResponse.json({ success: false, error: 'Valid source_type is required' }, { status: 400 });
    const { rows } = await query(
      `INSERT INTO funding_sources (project_id, source_type, name, amount, currency, reference, status, created_by)
       VALUES ($1,$2,$3,COALESCE($4,0),COALESCE($5,'UGX'),$6,COALESCE($7,'pledged'),$8) RETURNING *`,
      [id, b.source_type, b.name || null, b.amount ?? null, b.currency || null, b.reference || null, b.status || null, auth.userId]
    );
    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Funding] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to add funding source' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/funding?fundingId=...
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  const fundingId = new URL(request.url).searchParams.get('fundingId');
  if (!fundingId) return NextResponse.json({ success: false, error: 'fundingId is required' }, { status: 400 });
  await query(`DELETE FROM funding_sources WHERE id=$1 AND project_id=$2`, [fundingId, id]);
  return NextResponse.json({ success: true });
}
