import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;

  const docRes = await query(
    `SELECT d.*, u.full_name AS uploaded_by_name, f.name AS folder_name
     FROM documents d
     LEFT JOIN users u ON d.uploaded_by = u.id
     LEFT JOIN document_folders f ON d.folder_id = f.id
     WHERE d.id = $1`,
    [id]
  );
  if (!docRes.rows.length) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const [versions, comments, permissions, approvals, links, tags] = await Promise.all([
    query('SELECT * FROM document_versions WHERE document_id = $1 ORDER BY version DESC', [id]),
    query(`SELECT c.*, u.full_name AS author_name FROM document_comments c
           LEFT JOIN users u ON c.author_id = u.id WHERE c.document_id = $1
           ORDER BY c.created_at`, [id]),
    query('SELECT * FROM document_permissions WHERE document_id = $1', [id]),
    query(`SELECT a.*, u.full_name AS approver_name FROM document_approvals a
           LEFT JOIN users u ON a.approver_id = u.id WHERE a.document_id = $1
           ORDER BY a.step_order`, [id]),
    query('SELECT * FROM document_links WHERE document_id = $1', [id]),
    query(`SELECT t.* FROM document_tags t
           JOIN document_tag_links l ON l.tag_id = t.id WHERE l.document_id = $1`, [id]),
  ]);

  return NextResponse.json({
    success: true,
    document: docRes.rows[0],
    versions: versions.rows,
    comments: comments.rows,
    permissions: permissions.rows,
    approvals: approvals.rows,
    links: links.rows,
    tags: tags.rows,
  });
}

export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'documents.edit');
  if (perm instanceof NextResponse) {
    const fb = await requirePermission(request, 'documents.manage');
    if (fb instanceof NextResponse) return fb;
  }
  const auth = (perm instanceof NextResponse
    ? await requirePermission(request, 'documents.manage')
    : perm).auth;

  const { id } = await params;
  const body = await request.json();
  const allowed = ['title', 'description', 'category', 'folder_id', 'body', 'body_format',
                   'visibility', 'tags', 'metadata', 'approval_status', 'file_url', 'file_name'];
  const before = await query('SELECT * FROM documents WHERE id = $1', [id]);
  if (!before.rows.length) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const sets = [], values = [];
  for (const k of allowed) {
    if (body[k] === undefined) continue;
    values.push(k === 'metadata' ? JSON.stringify(body[k]) : body[k]);
    sets.push(`${k} = $${values.length}`);
  }
  if (!sets.length) return NextResponse.json({ success: false, error: 'No fields' }, { status: 400 });

  values.push(id);
  const r = await query(
    `UPDATE documents SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
    values
  );

  // Snapshot a new version when body or file changes
  const bodyChanged = body.body !== undefined || body.file_url !== undefined;
  if (bodyChanged) {
    const newVersion = (before.rows[0].current_version || 1) + 1;
    await query('UPDATE document_versions SET is_current = FALSE WHERE document_id = $1', [id]);
    await query(
      `INSERT INTO document_versions
         (document_id, version, title, body, body_format, file_url, file_name, file_size, is_current, created_by, changelog)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9,$10)`,
      [
        id, newVersion, r.rows[0].title, r.rows[0].body, r.rows[0].body_format,
        r.rows[0].file_url, r.rows[0].file_name, r.rows[0].file_size,
        auth.userId, body.changelog || null,
      ]
    );
    await query('UPDATE documents SET current_version = $1 WHERE id = $2', [newVersion, id]);
  }
  return NextResponse.json({ success: true, data: r.rows[0] });
}

export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'documents.delete');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const r = await query('DELETE FROM documents WHERE id = $1 RETURNING id', [id]);
  if (!r.rows.length) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
