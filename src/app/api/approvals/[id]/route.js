/**
 * PUT /api/approvals/[id] - Approve or reject an approval request
 * GET /api/approvals/[id] - Get approval request details
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { getUserHierarchyLevel, hasPermission, requirePermission } from '@/lib/permissions.js';
import { logRbacEvent, extractRbacMetadata } from '@/lib/rbac-audit.js';

export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'approvals.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;

    const result = await query(
      `SELECT ar.*, 
        u_req.name AS requester_name, u_req.email AS requester_email,
        u_app.name AS approver_name
      FROM approval_requests ar
      JOIN users u_req ON ar.requester_user_id = u_req.id
      LEFT JOIN users u_app ON ar.approver_user_id = u_app.id
      WHERE ar.id = $1`,
      [id]
    );

    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Approval request not found' }, { status: 404 });
    }

    // Allow the requester themselves, anyone with approvals.view_all, or
    // anyone with strictly higher hierarchy than the requester. The legacy
    // hardcoded 'superadmin' check is now redundant — superadmin satisfies
    // approvals.view_all via the perm-cache bypass.
    const req = result.rows[0];
    const isOwner = req.requester_user_id === auth.userId;
    const canViewAll = await hasPermission(auth.userId, 'approvals', 'view_all', auth.role);
    if (!isOwner && !canViewAll) {
      const myLevel = await getUserHierarchyLevel(auth.userId);
      const requesterLevel = await getUserHierarchyLevel(req.requester_user_id);
      if (myLevel >= requesterLevel) {
        return NextResponse.json({ success: false, error: 'Insufficient authority to view this request' }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, data: req });
  } catch (error) {
    console.error('Failed to fetch approval:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch approval request' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'approvals.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const { status, notes } = await request.json();

    if (!status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Status must be "approved" or "rejected"' },
        { status: 400 }
      );
    }

    // Fetch the request
    const reqResult = await query(
      'SELECT * FROM approval_requests WHERE id = $1',
      [id]
    );

    if (!reqResult.rows[0]) {
      return NextResponse.json({ success: false, error: 'Approval request not found' }, { status: 404 });
    }

    const approvalReq = reqResult.rows[0];

    if (approvalReq.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'This request has already been resolved' },
        { status: 400 }
      );
    }

    // Verify authority: approver must either have approvals.override
    // (granted to superadmins via perm-cache bypass) OR strictly higher
    // hierarchy than the requester. No hardcoded role string.
    const canOverride = await hasPermission(auth.userId, 'approvals', 'override', auth.role);
    if (!canOverride) {
      const [approverLevel, requesterLevel] = await Promise.all([
        getUserHierarchyLevel(auth.userId),
        getUserHierarchyLevel(approvalReq.requester_user_id),
      ]);

      if (approverLevel >= requesterLevel) {
        return NextResponse.json(
          { success: false, error: 'You do not have sufficient authority to resolve this request' },
          { status: 403 }
        );
      }
    }

    // Cannot approve own request
    if (approvalReq.requester_user_id === auth.userId) {
      return NextResponse.json(
        { success: false, error: 'You cannot approve your own request' },
        { status: 400 }
      );
    }

    // Resolve the request
    const result = await query(
      `UPDATE approval_requests
       SET status = $1, approver_user_id = $2, approver_notes = $3, resolved_at = NOW()
       WHERE id = $4 AND status = 'pending'
       RETURNING *`,
      [status, auth.userId, notes || null, id]
    );

    if (!result.rows[0]) {
      return NextResponse.json(
        { success: false, error: 'Failed to resolve request' },
        { status: 500 }
      );
    }

    // Audit log
    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: `approval_request_${status}`,
      entityType: 'approval_request',
      entityId: id,
      details: {
        requesterId: approvalReq.requester_user_id,
        targetRecordType: approvalReq.target_record_type,
        targetRecordId: approvalReq.target_record_id,
        actionRequested: approvalReq.action_requested,
        notes,
      },
      ...meta,
    });

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Failed to resolve approval:', error);
    return NextResponse.json({ success: false, error: 'Failed to resolve approval request' }, { status: 500 });
  }
}
