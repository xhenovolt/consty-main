/**
 * GET /api/issues/[id]
 */

import { getCurrentUser } from '@/lib/current-user.js';
import { query } from '@/lib/db.js';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = params;
    
    const result = await query(
      'SELECT * FROM issues WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Issue not found' },
        { status: 404 }
      );
    }
    
    return Response.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[issue GET] Error:', error.message);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/issues/[id]
 * Update issue status, assignment, resolution
 */
export async function PATCH(req, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user || !['superadmin', 'admin'].includes(user.role)) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { status, assigned_to_user_id, resolution_notes } = body;

    if (!status) {
      return Response.json(
        { success: false, error: 'status is required' },
        { status: 400 }
      );
    }

    // Build update query
    let updateFields = ['status = $1', `updated_at = NOW()`];
    let params = [status];
    let paramIndex = 2;

    if (assigned_to_user_id) {
      updateFields.push(`assigned_to_user_id = $${paramIndex++}`);
      params.push(assigned_to_user_id);
    }

    if (resolution_notes) {
      updateFields.push(`resolution_notes = $${paramIndex++}`);
      params.push(resolution_notes);
    }

    if (status === 'resolved') {
      updateFields.push(`resolved_at = NOW()`);
    }

    params.push(id);
    const sqlUpdateIndex = paramIndex;

    const result = await query(
      `UPDATE issues SET ${updateFields.join(', ')} WHERE id = $${sqlUpdateIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Issue not found' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[issue PATCH] Error:', error.message);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/issues/[id]
 */
export async function DELETE(req, { params }) {
  const { id } = params;
  
  try {
    const result = await query(
      'DELETE FROM issues WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting issue:', error);
    return NextResponse.json(
      { error: 'Failed to delete issue' },
      { status: 500 }
    );
  }
}
