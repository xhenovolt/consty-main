import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * GET /api/decision-logs/[id] — Get single decision log with full detail
 */
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'activity_logs.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;

    const result = await query(
      `SELECT dl.*, u.name as decided_by_name, ru.name as reviewed_by_name, d.name as department_name
       FROM decision_logs dl
       LEFT JOIN users u ON dl.decided_by = u.id
       LEFT JOIN users ru ON dl.reviewed_by = ru.id
       LEFT JOIN departments d ON dl.department_id = d.id
       WHERE dl.id = $1`,
      [id]
    );

    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Decision not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[DecisionLogs] GET detail error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch decision' }, { status: 500 });
  }
}

/**
 * PUT /api/decision-logs/[id] — Update decision log entry
 */
export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'activity_logs.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const body = await request.json();

    const allowedFields = ['title', 'description', 'category', 'priority', 'status', 'decision_date', 'context', 'alternatives', 'consequences', 'stakeholders', 'related_entity_type', 'related_entity_id', 'tags', 'department_id', 'review_notes', 'is_archived'];
    const setClauses = [];
    const values = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        values.push(body[field]);
        setClauses.push(`${field} = $${values.length}`);
      }
    }

    if (setClauses.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });

    // If status changes to a review state, stamp reviewer
    if (body.status === 'implemented' || body.review_notes) {
      values.push(auth.userId);
      setClauses.push(`reviewed_by = $${values.length}`);
      setClauses.push(`review_date = CURRENT_DATE`);
    }

    setClauses.push('updated_at = NOW()');
    values.push(id);

    const result = await query(
      `UPDATE decision_logs SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Decision not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[DecisionLogs] PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update decision' }, { status: 500 });
  }
}

/**
 * DELETE /api/decision-logs/[id]
 */
export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'activity_logs.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;

    const result = await query(`DELETE FROM decision_logs WHERE id = $1 RETURNING title`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Decision not found' }, { status: 404 });

    dispatch('decision_deleted', {
      entityType: 'decision_log',
      entityId: id,
      description: `Decision log "${result.rows[0].title}" deleted`,
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
  }
}
