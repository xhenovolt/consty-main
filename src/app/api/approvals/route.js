/**
 * GET /api/approvals - List approval requests (pending for authorized users, own for all)
 * POST /api/approvals - Create a new approval request
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { getUserHierarchyLevel } from '@/lib/permissions.js';
import { logRbacEvent, extractRbacMetadata } from '@/lib/rbac-audit.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'approvals.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending, approved, rejected, or null for all
    const view = searchParams.get('view'); // 'mine' for own requests, 'pending' for requests to approve
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    let sql, params;

    if (view === 'mine') {
      // User's own requests
      sql = `
        SELECT ar.*, 
          u_approver.name AS approver_name
        FROM approval_requests ar
        LEFT JOIN users u_approver ON ar.approver_user_id = u_approver.id
        WHERE ar.requester_user_id = $1
        ${status ? 'AND ar.status = $2' : ''}
        ORDER BY ar.created_at DESC
        LIMIT $${status ? '3' : '2'} OFFSET $${status ? '4' : '3'}`;
      params = status
        ? [auth.userId, status, limit, offset]
        : [auth.userId, limit, offset];
    } else {
      // Requests available for this user to approve (must have higher authority)
      const hierarchyLevel = await getUserHierarchyLevel(auth.userId);

      sql = `
        SELECT ar.*, 
          u_req.name AS requester_name, u_req.email AS requester_email
        FROM approval_requests ar
        JOIN users u_req ON ar.requester_user_id = u_req.id
        WHERE ar.status = 'pending'
          AND $1 < (
            SELECT COALESCE(MIN(r.hierarchy_level), 5)
            FROM users u2
            JOIN staff s2 ON u2.staff_id = s2.id
            JOIN staff_roles sr2 ON sr2.staff_id = s2.id
            JOIN roles r ON sr2.role_id = r.id
            WHERE u2.id = ar.requester_user_id
          )
        ORDER BY ar.created_at DESC
        LIMIT $2 OFFSET $3`;
      params = [hierarchyLevel, limit, offset];
    }

    const result = await query(sql, params);

    // Count totals
    let totalPending = 0;
    try {
      const countResult = await query(
        `SELECT COUNT(*) AS cnt FROM approval_requests WHERE status = 'pending'`
      );
      totalPending = parseInt(countResult.rows[0]?.cnt || 0, 10);
    } catch (_) {}

    return NextResponse.json({
      success: true,
      data: result.rows,
      meta: { total_pending: totalPending, limit, offset },
    });
  } catch (error) {
    console.error('Failed to fetch approvals:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch approvals' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'approvals.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { target_record_type, target_record_id, action_requested, reason } = await request.json();

    if (!target_record_type || !action_requested) {
      return NextResponse.json(
        { success: false, error: 'target_record_type and action_requested are required' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO approval_requests (requester_user_id, target_record_type, target_record_id, action_requested, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, status, created_at`,
      [auth.userId, target_record_type, target_record_id || null, action_requested, reason || null]
    );

    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: 'approval_request_submitted',
      entityType: 'approval_request',
      entityId: result.rows[0].id,
      details: { targetRecordType: target_record_type, targetRecordId: target_record_id, actionRequested: action_requested },
      ...meta,
    });

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Failed to create approval request:', error);
    return NextResponse.json({ success: false, error: 'Failed to create approval request' }, { status: 500 });
  }
}
