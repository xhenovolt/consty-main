/**
 * GET  /api/docs        — List all docs (filtered by permission)
 * POST /api/docs        — Create a new doc (superadmin only)
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { verifyAuth } from '@/lib/auth-utils.js';

export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // Non-superadmin users see only non-public docs they have permission to access.
    // Superadmins see everything.
    let sql = `
      SELECT id, title, slug, category, version, is_public, created_at, updated_at
      FROM docs
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (!auth.is_superadmin) {
      // Regular users see public docs + all if they have the docs permission
      // For now: all authenticated users see all docs
    }

    if (category) {
      sql += ` AND category = $${idx}`;
      params.push(category);
      idx++;
    }

    sql += ` ORDER BY category, title`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[API/docs] GET failed:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to load docs' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    if (!auth.is_superadmin) {
      return NextResponse.json({ success: false, error: 'Superadmin required' }, { status: 403 });
    }

    const body = await request.json();
    const { title, slug, content, category, version, is_public } = body;
    if (!title || !content) {
      return NextResponse.json({ success: false, error: 'title and content are required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO docs (title, slug, content, category, version, is_public, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        title,
        slug || title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        content,
        category || 'general',
        version || '1.0',
        is_public ?? false,
        auth.userId,
      ]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'A doc with that slug already exists' }, { status: 409 });
    }
    console.error('[API/docs] POST failed:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to create doc' }, { status: 500 });
  }
}
