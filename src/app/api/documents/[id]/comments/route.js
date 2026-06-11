import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const { body, parent_id } = await request.json().catch(() => ({}));
  if (!body?.trim()) return NextResponse.json({ success: false, error: 'body required' }, { status: 400 });

  const r = await query(
    `INSERT INTO document_comments (document_id, parent_id, author_id, body)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [id, parent_id || null, auth.userId, body]
  );
  return NextResponse.json({ success: true, data: r.rows[0] }, { status: 201 });
}

export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const { comment_id, resolved } = await request.json().catch(() => ({}));
  if (!comment_id) return NextResponse.json({ success: false, error: 'comment_id required' }, { status: 400 });

  const r = await query(
    `UPDATE document_comments
       SET resolved = $1,
           resolved_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
           resolved_by = CASE WHEN $1 THEN $2 ELSE NULL END
     WHERE id = $3 AND document_id = $4 RETURNING *`,
    [!!resolved, auth.userId, comment_id, id]
  );
  if (!r.rows.length) return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: r.rows[0] });
}
