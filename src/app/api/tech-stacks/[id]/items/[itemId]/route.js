import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';

export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'systems.manage');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id, itemId } = params;
    const { type, name, version, notes } = await request.json();

    const result = await query(
      `UPDATE tech_stack_items
       SET type = COALESCE($1, type),
           name = COALESCE($2, name),
           version = COALESCE($3, version),
           notes = COALESCE($4, notes),
           updated_at = NOW()
       WHERE id = $5 AND tech_stack_id = $6
       RETURNING *`,
      [type, name, version, notes, itemId, id]
    );

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'systems.manage');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id, itemId } = params;

    const result = await query(
      `DELETE FROM tech_stack_items WHERE id = $1 AND tech_stack_id = $2 RETURNING id`,
      [itemId, id]
    );

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
