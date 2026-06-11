import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'designs.view');
  if (perm instanceof NextResponse) return perm;
  const { searchParams } = new URL(request.url);
  const type     = searchParams.get('type');
  const category = searchParams.get('category');
  const search   = searchParams.get('search');
  const params = [];
  let where = 'WHERE 1=1';
  if (type)     { params.push(type);     where += ` AND asset_type = $${params.length}`; }
  if (category) { params.push(category); where += ` AND category   = $${params.length}`; }
  if (search)   { params.push(`%${search.toLowerCase()}%`); where += ` AND LOWER(name) LIKE $${params.length}`; }
  const r = await query(
    `SELECT * FROM design_assets ${where} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  return NextResponse.json({ success: true, data: r.rows });
}

export async function POST(request) {
  const perm = await requirePermission(request, 'designs.manage_assets');
  if (perm instanceof NextResponse) {
    const fb = await requirePermission(request, 'designs.create');
    if (fb instanceof NextResponse) return fb;
  }
  const auth = (perm instanceof NextResponse
    ? await requirePermission(request, 'designs.create')
    : perm).auth;

  const body = await request.json().catch(() => ({}));
  const { name, asset_type, category, file_url, thumbnail_url, width, height, mime_type, file_size, tags, metadata } = body;
  if (!name || !asset_type || !file_url)
    return NextResponse.json({ success: false, error: 'name, asset_type, file_url required' }, { status: 400 });

  const r = await query(
    `INSERT INTO design_assets
       (name, asset_type, category, file_url, thumbnail_url, width, height, mime_type, file_size, tags, metadata, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      name, asset_type, category || null, file_url, thumbnail_url || null,
      width || null, height || null, mime_type || null, file_size || null,
      tags || [], JSON.stringify(metadata || {}), auth.userId,
    ]
  );
  return NextResponse.json({ success: true, data: r.rows[0] }, { status: 201 });
}
