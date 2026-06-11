import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// POST /api/designs/[id]/clone — duplicate a design (or template) as a new user design
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'designs.create');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;

  try {
    const existing = await query(
      `SELECT * FROM user_designs WHERE id = $1 AND (created_by = $2 OR is_template = TRUE)`,
      [id, auth.userId]
    );
    if (!existing.rows[0]) {
      return NextResponse.json({ success: false, error: 'Design not found' }, { status: 404 });
    }

    const src = existing.rows[0];
    const result = await query(
      `INSERT INTO user_designs (name, canvas, layers, thumbnail, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [`${src.name} (copy)`, JSON.stringify(src.canvas), JSON.stringify(src.layers), src.thumbnail, auth.userId]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Designs] clone error:', error);
    return NextResponse.json({ success: false, error: 'Failed to clone design' }, { status: 500 });
  }
}
