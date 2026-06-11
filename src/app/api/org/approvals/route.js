/**
 * GET /api/org/approvals - Get approvals routed by authority hierarchy
 * POST /api/org/approvals - Submit an approval request with authority routing
 * PUT /api/org/approvals - Resolve (approve/reject) if caller has sufficient authority
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';

// Authority rank required per approval category
const CATEGORY_AUTHORITY = {
  expense_approval: 40,    // Manager+
  staff_hiring: 60,        // Director+
  deal_approval: 40,       // Manager+
  budget_allocation: 80,   // Executive+
  system_change: 80,       // Executive+
};

export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'approvals.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    // Get user's max authority rank
    const userAuth = await query(
      `SELECT MAX(al.rank_value) AS max_rank
       FROM organizational_structure os
       JOIN authority_levels al ON os.authority_level_id = al.id
       WHERE os.staff_assigned_id = $1 AND os.status = 'active'`,
      [auth.userId]
    );
    const userRank = userAuth.rows[0]?.max_rank || 0;

    // Return approvals at or below user's authority level
    const result = await query(
      `SELECT ar.*, u.name AS requester_name, u.email AS requester_email,
              au.name AS approver_name
       FROM approval_requests ar
       JOIN users u ON ar.requester_user_id = u.id
       LEFT JOIN users au ON ar.approver_user_id = au.id
       WHERE ar.status = $1
         AND (ar.required_authority_rank <= $2 OR $3 = 'superadmin')
       ORDER BY ar.created_at DESC`,
      [status, userRank, auth.role]
    );

    return NextResponse.json({ success: true, data: result.rows, user_authority_rank: userRank });
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

    const { target_record_type, target_record_id, action_requested, reason, category } = await request.json();
    if (!target_record_type || !target_record_id || !action_requested) {
      return NextResponse.json({ success: false, error: 'target_record_type, target_record_id, and action_requested are required' }, { status: 400 });
    }

    const requiredRank = CATEGORY_AUTHORITY[category] || 40;

    // Build escalation path from org hierarchy
    const escalation = await query(
      `SELECT os.id, os.node_name, al.name AS authority_name, al.rank_value,
              u.name AS staff_name, u.id AS staff_id
       FROM organizational_structure os
       JOIN authority_levels al ON os.authority_level_id = al.id
       LEFT JOIN users u ON os.staff_assigned_id = u.id
       WHERE al.rank_value >= $1 AND os.status = 'active' AND os.staff_assigned_id IS NOT NULL
       ORDER BY al.rank_value ASC
       LIMIT 5`,
      [requiredRank]
    );

    const result = await query(
      `INSERT INTO approval_requests
        (requester_user_id, target_record_type, target_record_id, action_requested, reason, category, required_authority_rank, escalation_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [auth.userId, target_record_type, target_record_id, action_requested, reason || null,
       category || null, requiredRank, JSON.stringify(escalation.rows)]
    );

    dispatch('approval_submitted', {
      entityType: 'approval', entityId: result.rows[0].id,
      description: `Approval request: ${action_requested} on ${target_record_type}`,
      metadata: { category, requiredRank },
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Failed to create approval:', error);
    return NextResponse.json({ success: false, error: 'Failed to create approval' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

    const { approval_id, status, notes } = await request.json();
    if (!approval_id || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ success: false, error: 'approval_id and valid status (approved/rejected) required' }, { status: 400 });
    }

    // Verify user has sufficient authority
    const approval = await query('SELECT * FROM approval_requests WHERE id = $1 AND status = $2', [approval_id, 'pending']);
    if (!approval.rows[0]) {
      return NextResponse.json({ success: false, error: 'Approval not found or already resolved' }, { status: 404 });
    }

    const userAuth = await query(
      `SELECT MAX(al.rank_value) AS max_rank
       FROM organizational_structure os
       JOIN authority_levels al ON os.authority_level_id = al.id
       WHERE os.staff_assigned_id = $1 AND os.status = 'active'`,
      [auth.userId]
    );
    const userRank = userAuth.rows[0]?.max_rank || 0;

    if (userRank < approval.rows[0].required_authority_rank && auth.role !== 'superadmin') {
      return NextResponse.json({
        success: false,
        error: `Insufficient authority. Required: ${approval.rows[0].required_authority_rank}, yours: ${userRank}`,
      }, { status: 403 });
    }

    const result = await query(
      `UPDATE approval_requests SET
        status = $1, approver_user_id = $2, approver_notes = $3,
        current_authority_rank = $4, resolved_at = NOW()
       WHERE id = $5 RETURNING *`,
      [status, auth.userId, notes || null, userRank, approval_id]
    );

    dispatch(`approval_${status}`, {
      entityType: 'approval', entityId: approval_id,
      description: `Approval ${status}: ${approval.rows[0].action_requested}`,
      metadata: { category: approval.rows[0].category, approverRank: userRank },
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Failed to resolve approval:', error);
    return NextResponse.json({ success: false, error: 'Failed to resolve approval' }, { status: 500 });
  }
}
