/**
 * PUT /api/admin/authority-levels/[id] - Update authority level
 * DELETE /api/admin/authority-levels/[id] - Soft-delete authority level
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';

export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const { name, description, rank_value, color_indicator } = await request.json();

    const old = await query('SELECT * FROM authority_levels WHERE id = $1', [id]);
    if (!old.rows[0]) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const result = await query(
      `UPDATE authority_levels SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        rank_value = COALESCE($3, rank_value),
        color_indicator = COALESCE($4, color_indicator),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name || null, description !== undefined ? description : null, rank_value !== undefined ? parseInt(rank_value) : null, color_indicator || null, id]
    );

    await query(
      `INSERT INTO org_change_logs (changed_by, change_type, entity_type, entity_id, old_structure, new_structure, description)
       VALUES ($1, 'updated', 'authority_level', $2, $3, $4, $5)`,
      [auth.userId, id, JSON.stringify(old.rows[0]), JSON.stringify(result.rows[0]), `Authority level "${result.rows[0].name}" updated`]
    );

    dispatch('authority_level_updated', {
      entityType: 'authority_level', entityId: id,
      description: `Authority level "${result.rows[0].name}" updated`,
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'Authority level name already exists' }, { status: 409 });
    }
    console.error('Failed to update authority level:', error);
    return NextResponse.json({ success: false, error: 'Failed to update authority level' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;

    const old = await query('SELECT * FROM authority_levels WHERE id = $1', [id]);
    if (!old.rows[0]) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    // Check if used by org nodes
    const inUse = await query('SELECT COUNT(*) AS cnt FROM organizational_structure WHERE authority_level_id = $1 AND status != $2', [id, 'archived']);
    if (parseInt(inUse.rows[0].cnt) > 0) {
      return NextResponse.json({ success: false, error: 'Cannot delete — authority level is assigned to active org nodes' }, { status: 400 });
    }

    await query('UPDATE authority_levels SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);

    await query(
      `INSERT INTO org_change_logs (changed_by, change_type, entity_type, entity_id, old_structure, description)
       VALUES ($1, 'deleted', 'authority_level', $2, $3, $4)`,
      [auth.userId, id, JSON.stringify(old.rows[0]), `Authority level "${old.rows[0].name}" deactivated`]
    );

    dispatch('authority_level_deleted', {
      entityType: 'authority_level', entityId: id,
      description: `Authority level "${old.rows[0].name}" deactivated`,
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, message: 'Authority level deactivated' });
  } catch (error) {
    console.error('Failed to delete authority level:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete authority level' }, { status: 500 });
  }
}
