import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'designs.view');
  if (perm instanceof NextResponse) return perm;
  const { searchParams } = new URL(request.url);
  const category  = searchParams.get('category');
  const published = searchParams.get('published');

  const params = [];
  let where = 'WHERE 1=1';
  if (category)  { params.push(category);  where += ` AND category = $${params.length}`; }
  if (published) { params.push(published === 'true'); where += ` AND is_published = $${params.length}`; }

  const r = await query(
    `SELECT t.*, u.full_name AS created_by_name
     FROM design_templates t
     LEFT JOIN users u ON t.created_by = u.id
     ${where}
     ORDER BY t.use_count DESC, t.created_at DESC LIMIT 200`,
    params
  );
  return NextResponse.json({ success: true, data: r.rows });
}

export async function POST(request) {
  const perm = await requirePermission(request, 'designs.publish');
  if (perm instanceof NextResponse) {
    const fb = await requirePermission(request, 'designs.create');
    if (fb instanceof NextResponse) return fb;
  }
  const auth = (perm instanceof NextResponse
    ? await requirePermission(request, 'designs.create')
    : perm).auth;

  const body = await request.json().catch(() => ({}));
  const { name, description, category, canvas, layers, tags, thumbnail_url, is_published, is_premium } = body;
  if (!name) return NextResponse.json({ success: false, error: 'name required' }, { status: 400 });

  const r = await query(
    `INSERT INTO design_templates
       (name, description, category, canvas, layers, tags, thumbnail_url, is_published, is_premium, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      name, description || null, category || null,
      JSON.stringify(canvas || { width: 1080, height: 1080 }),
      JSON.stringify(layers || []),
      tags || [], thumbnail_url || null,
      !!is_published, !!is_premium,
      auth.userId,
    ]
  );

  // Seed v1 snapshot
  await query(
    `INSERT INTO design_template_versions (template_id, version, canvas, layers, thumbnail_url, created_by)
     VALUES ($1, 1, $2, $3, $4, $5)`,
    [r.rows[0].id, r.rows[0].canvas, r.rows[0].layers, r.rows[0].thumbnail_url, auth.userId]
  );

  return NextResponse.json({ success: true, data: r.rows[0] }, { status: 201 });
}
