import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission, hasPermission } from '@/lib/permissions.js';

// GET /api/designs/[id]
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'designs.view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;

  try {
    const result = await query(
      `SELECT * FROM user_designs WHERE id = $1 AND (created_by = $2 OR is_template = TRUE)`,
      [id, auth.userId]
    );
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Design not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Designs] GET[id] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch design' }, { status: 500 });
  }
}

// PATCH /api/designs/[id] — auto-save (name, canvas, layers, thumbnail)
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'designs.edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;

  try {
    const body = await request.json();
    const { name, canvas, layers, thumbnail } = body;

    // Ownership check (templates editable only by superadmin)
    const existing = await query(
      `SELECT created_by, is_template FROM user_designs WHERE id = $1`,
      [id]
    );
    if (!existing.rows[0]) {
      return NextResponse.json({ success: false, error: 'Design not found' }, { status: 404 });
    }
    const design = existing.rows[0];
    // Allow the creator OR any role with designs.manage_others (which
    // superadmins satisfy automatically) to edit. Hardcoded role string
    // removed so any custom role can be granted the permission.
    if (design.created_by !== auth.userId &&
        !(await hasPermission(auth.userId, 'designs', 'manage_others', auth.role))) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const sets = [];
    const vals = [];
    if (name !== undefined)      { vals.push(name);                   sets.push(`name = $${vals.length}`); }
    if (canvas !== undefined)    { vals.push(JSON.stringify(canvas));  sets.push(`canvas = $${vals.length}`); }
    if (layers !== undefined)    { vals.push(JSON.stringify(layers));  sets.push(`layers = $${vals.length}`); }
    if (thumbnail !== undefined) { vals.push(thumbnail);              sets.push(`thumbnail = $${vals.length}`); }

    if (sets.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    vals.push(id);
    const result = await query(
      `UPDATE user_designs SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Designs] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save design' }, { status: 500 });
  }
}

// DELETE /api/designs/[id]
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'designs.delete');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;

  try {
    const result = await query(
      `DELETE FROM user_designs WHERE id = $1 AND (created_by = $2 OR $3 = 'superadmin') RETURNING id`,
      [id, auth.userId, auth.role]
    );
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Design not found or forbidden' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Designs] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete design' }, { status: 500 });
  }
}
