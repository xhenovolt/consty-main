import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;
  const r = await query(
    `SELECT t.*, (SELECT COUNT(*) FROM document_tag_links l WHERE l.tag_id = t.id) AS use_count
     FROM document_tags t ORDER BY t.name`
  );
  return NextResponse.json({ success: true, data: r.rows });
}

export async function POST(request) {
  const perm = await requirePermission(request, 'documents.edit');
  if (perm instanceof NextResponse) {
    const fb = await requirePermission(request, 'documents.manage');
    if (fb instanceof NextResponse) return fb;
  }
  const { name, color } = await request.json().catch(() => ({}));
  if (!name) return NextResponse.json({ success: false, error: 'name required' }, { status: 400 });
  const r = await query(
    `INSERT INTO document_tags (name, color) VALUES ($1,$2)
     ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color RETURNING *`,
    [name.toLowerCase(), color || null]
  );
  return NextResponse.json({ success: true, data: r.rows[0] }, { status: 201 });
}
