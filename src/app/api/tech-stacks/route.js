import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'systems.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = parseInt(searchParams.get('offset')) || 0;

    const result = await query(
      `SELECT id, name, description, created_by, created_at, updated_at,
              (SELECT COUNT(*) FROM tech_stack_items WHERE tech_stack_id = tech_stacks.id) as item_count,
              (SELECT COUNT(*) FROM systems WHERE tech_stack_id = tech_stacks.id) as system_count
       FROM tech_stacks
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return NextResponse.json({
      stacks: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, 'systems.manage');
  if (perm instanceof NextResponse) return perm;

  try {
    const { name, description } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Stack name required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO tech_stacks (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description, perm.userId]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    if (err.message.includes('duplicate')) {
      return NextResponse.json({ error: 'Stack name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
