import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;
  const r = await query(
    `SELECT f.*, (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id) AS doc_count
     FROM document_folders f ORDER BY f.path NULLS FIRST, f.name`
  );
  return NextResponse.json({ success: true, data: r.rows });
}

export async function POST(request) {
  const perm = await requirePermission(request, 'documents.create');
  if (perm instanceof NextResponse) {
    const fb = await requirePermission(request, 'documents.manage');
    if (fb instanceof NextResponse) return fb;
  }
  const auth = (perm instanceof NextResponse
    ? await requirePermission(request, 'documents.manage')
    : perm).auth;

  const { name, description, parent_id } = await request.json().catch(() => ({}));
  if (!name) return NextResponse.json({ success: false, error: 'name required' }, { status: 400 });

  let path = name;
  if (parent_id) {
    const p = await query('SELECT path, name FROM document_folders WHERE id = $1', [parent_id]);
    if (p.rows.length) path = `${p.rows[0].path || p.rows[0].name}/${name}`;
  }

  const r = await query(
    `INSERT INTO document_folders (name, description, parent_id, path, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, description || null, parent_id || null, path, auth.userId]
  );
  return NextResponse.json({ success: true, data: r.rows[0] }, { status: 201 });
}
