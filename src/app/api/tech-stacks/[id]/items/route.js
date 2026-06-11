import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';

export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'systems.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = params;

    const result = await query(
      `SELECT * FROM tech_stack_items WHERE tech_stack_id = $1 ORDER BY type, name`,
      [id]
    );

    return NextResponse.json({ items: result.rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'systems.manage');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = params;
    const { type, name, version, notes } = await request.json();

    if (!type || !name) {
      return NextResponse.json({ error: 'Type and name required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO tech_stack_items (tech_stack_id, type, name, version, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, type, name, version, notes]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
