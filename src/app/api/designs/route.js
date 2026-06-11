import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/designs — list designs for current user + all templates
export async function GET(request) {
  const perm = await requirePermission(request, 'designs.view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { searchParams } = new URL(request.url);
    const templates = searchParams.get('templates') === 'true';

    let sql, params;
    if (templates) {
      sql = `SELECT id, name, thumbnail, canvas, is_template, created_at, updated_at
             FROM user_designs WHERE is_template = TRUE ORDER BY created_at ASC`;
      params = [];
    } else {
      sql = `SELECT id, name, thumbnail, canvas, is_template, created_at, updated_at
             FROM user_designs
             WHERE created_by = $1 OR is_template = TRUE
             ORDER BY is_template ASC, updated_at DESC`;
      params = [auth.userId];
    }

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Designs] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch designs' }, { status: 500 });
  }
}

// POST /api/designs — create new design
export async function POST(request) {
  const perm = await requirePermission(request, 'designs.create');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const body = await request.json();
    const { name = 'Untitled Design', canvas = { width: 1080, height: 1080, background: '#ffffff' }, layers = [], thumbnail } = body;

    const result = await query(
      `INSERT INTO user_designs (name, canvas, layers, thumbnail, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, JSON.stringify(canvas), JSON.stringify(layers), thumbnail || null, auth.userId]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Designs] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create design' }, { status: 500 });
  }
}
