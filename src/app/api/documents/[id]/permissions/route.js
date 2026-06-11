import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const r = await query('SELECT * FROM document_permissions WHERE document_id = $1', [id]);
  return NextResponse.json({ success: true, data: r.rows });
}

export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'documents.share');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const { principal_type, principal_id, permission } = await request.json().catch(() => ({}));
  if (!principal_type || !principal_id || !permission)
    return NextResponse.json({ success: false, error: 'principal_type, principal_id, permission required' }, { status: 400 });

  const r = await query(
    `INSERT INTO document_permissions (document_id, principal_type, principal_id, permission, granted_by)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING *`,
    [id, principal_type, principal_id, permission, auth.userId]
  );
  return NextResponse.json({ success: true, data: r.rows[0] || null });
}

export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'documents.share');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const grantId = searchParams.get('grant_id');
  if (!grantId) return NextResponse.json({ success: false, error: 'grant_id required' }, { status: 400 });
  await query('DELETE FROM document_permissions WHERE id = $1 AND document_id = $2', [grantId, id]);
  return NextResponse.json({ success: true });
}
