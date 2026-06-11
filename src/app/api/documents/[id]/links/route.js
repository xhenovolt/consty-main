import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const r = await query('SELECT * FROM document_links WHERE document_id = $1 ORDER BY created_at DESC', [id]);
  return NextResponse.json({ success: true, data: r.rows });
}

export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'documents.edit');
  if (perm instanceof NextResponse) {
    const fb = await requirePermission(request, 'documents.manage');
    if (fb instanceof NextResponse) return fb;
  }
  const auth = (perm instanceof NextResponse
    ? await requirePermission(request, 'documents.manage')
    : perm).auth;
  const { id } = await params;
  const { entity_type, entity_id, relationship } = await request.json().catch(() => ({}));
  if (!entity_type || !entity_id)
    return NextResponse.json({ success: false, error: 'entity_type and entity_id required' }, { status: 400 });

  const r = await query(
    `INSERT INTO document_links (document_id, entity_type, entity_id, relationship, created_by)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING *`,
    [id, entity_type, entity_id, relationship || 'attached', auth.userId]
  );
  return NextResponse.json({ success: true, data: r.rows[0] || null });
}

export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'documents.edit');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const linkId = searchParams.get('link_id');
  if (!linkId) return NextResponse.json({ success: false, error: 'link_id required' }, { status: 400 });
  await query('DELETE FROM document_links WHERE id = $1 AND document_id = $2', [linkId, id]);
  return NextResponse.json({ success: true });
}
