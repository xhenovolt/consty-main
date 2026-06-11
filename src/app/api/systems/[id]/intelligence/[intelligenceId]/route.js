import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { Events } from '@/lib/events.js';

/**
 * GET /api/systems/[id]/intelligence/[intelligenceId]
 * Fetch a specific intelligence entry
 */
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id, intelligenceId } = params;

    const result = await query(
      `SELECT 
        si.*,
        u_created.full_name as created_by_name,
        u_updated.full_name as updated_by_name,
        (SELECT COUNT(*) FROM system_intelligence_internal_notes WHERE intelligence_id = si.id) as internal_notes_count,
        (SELECT COUNT(*) FROM system_intelligence WHERE parent_intelligence_id = si.id) as child_count
      FROM system_intelligence si
      LEFT JOIN users u_created ON si.created_by = u_created.id
      LEFT JOIN users u_updated ON si.updated_by = u_updated.id
      WHERE si.id = $1 AND si.system_id = $2`,
      [intelligenceId, id]
    );

    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Intelligence entry not found' }, { status: 404 });
    }

    // Check visibility permissions
    const intelligence = result.rows[0];
    if (!intelligence.is_public && intelligence.created_by !== auth.userId && auth.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: intelligence });
  } catch (error) {
    console.error('[System Intelligence Detail] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch intelligence entry' }, { status: 500 });
  }
}

/**
 * PATCH /api/systems/[id]/intelligence/[intelligenceId]
 * Update an intelligence entry
 */
export async function PATCH(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.edit');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id, intelligenceId } = params;
    const updates = await request.json();

    // Check ownership/permissions
    const existing = await query(
      'SELECT created_by FROM system_intelligence WHERE id = $1 AND system_id = $2',
      [intelligenceId, id]
    );

    if (!existing.rows[0]) {
      return NextResponse.json({ success: false, error: 'Intelligence entry not found' }, { status: 404 });
    }

    if (existing.rows[0].created_by !== auth.userId && auth.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'You can only edit your own entries' }, { status: 403 });
    }

    // Build dynamic update query
    const allowedFields = ['title', 'category', 'content', 'summary', 'tags', 'version_tag', 'is_public'];
    const updateFields = [];
    const updateValues = [intelligenceId, id];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateValues.push(value);
        updateFields.push(`${key} = $${updateValues.length}`);
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
    }

    // Always update these
    updateValues.push(auth.userId);
    updateFields.push(`updated_by = $${updateValues.length}`);
    updateValues.push(new Date());
    updateFields.push(`updated_at = $${updateValues.length}`);
    updateValues.push(1);
    updateFields.push(`version_number = version_number + ${updateValues[updateValues.length - 1]}`);

    const result = await query(
      `UPDATE system_intelligence
       SET ${updateFields.join(', ')}
       WHERE id = $1 AND system_id = $2
       RETURNING *`,
      updateValues
    );

    // Log event
    Events.log('intelligence.updated', {
      userId: auth.userId,
      systemId: id,
      intelligenceId,
      changes: Object.keys(updates),
    });

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[System Intelligence Detail] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update intelligence entry' }, { status: 500 });
  }
}

/**
 * DELETE /api/systems/[id]/intelligence/[intelligenceId]
 * Delete an intelligence entry
 */
export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.edit');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id, intelligenceId } = params;

    // Check ownership/permissions
    const existing = await query(
      'SELECT created_by FROM system_intelligence WHERE id = $1 AND system_id = $2',
      [intelligenceId, id]
    );

    if (!existing.rows[0]) {
      return NextResponse.json({ success: false, error: 'Intelligence entry not found' }, { status: 404 });
    }

    if (existing.rows[0].created_by !== auth.userId && auth.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'You can only delete your own entries' }, { status: 403 });
    }

    // Delete the intelligence entry (cascade will handle related records)
    await query(
      'DELETE FROM system_intelligence WHERE id = $1 AND system_id = $2',
      [intelligenceId, id]
    );

    // Log event
    Events.log('intelligence.deleted', {
      userId: auth.userId,
      systemId: id,
      intelligenceId,
    });

    return NextResponse.json({ success: true, message: 'Intelligence entry deleted' });
  } catch (error) {
    console.error('[System Intelligence Detail] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete intelligence entry' }, { status: 500 });
  }
}
