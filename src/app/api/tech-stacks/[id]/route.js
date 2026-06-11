import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';

export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'systems.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = params;

    const stack = await query(
      `SELECT * FROM tech_stacks WHERE id = $1`,
      [id]
    );

    if (!stack.rows.length) {
      return NextResponse.json({ error: 'Tech stack not found' }, { status: 404 });
    }

    const items = await query(
      `SELECT * FROM tech_stack_items WHERE tech_stack_id = $1 ORDER BY type, name`,
      [id]
    );

    const linkedSystems = await query(
      `SELECT id, system_name FROM systems WHERE tech_stack_id = $1`,
      [id]
    );

    return NextResponse.json({
      stack: stack.rows[0],
      items: items.rows,
      linkedSystems: linkedSystems.rows,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'systems.manage');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = params;
    const { name, description } = await request.json();

    const result = await query(
      `UPDATE tech_stacks 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_by = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [name, description, perm.userId, id]
    );

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Tech stack not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'systems.delete');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = params;

    // Check if stack is linked to systems
    const linkedSystems = await query(
      `SELECT COUNT(*) as count FROM systems WHERE tech_stack_id = $1`,
      [id]
    );

    if (linkedSystems.rows[0].count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete stack linked to systems. Unlink systems first.' },
        { status: 400 }
      );
    }

    const result = await query(
      `DELETE FROM tech_stacks WHERE id = $1 RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Tech stack not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
