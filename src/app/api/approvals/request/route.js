import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission, getUserHierarchyLevel } from '@/lib/permissions.js';
import { logRbacEvent, extractRbacMetadata } from '@/lib/rbac-audit.js';

// POST /api/approvals/request
//
// Called by the client after a 403 response containing
// `can_request_approval: true`. Captures the full action context so a
// manager can review and replay it.
//
// Body: {
//   required_permission, action,
//   target_record_type?, target_record_id?,
//   replay_path?, replay_method?, payload?, reason?
// }
export async function POST(request) {
  let perm = await requirePermission(request, 'approvals.request');
  // Fall back to the older `approvals.manage` permission so existing roles
  // don't break before the new `approvals.request` permission is granted.
  if (perm instanceof NextResponse) {
    perm = await requirePermission(request, 'approvals.view');
    if (perm instanceof NextResponse) return perm;
  }
  const { auth } = perm;

  const body = await request.json().catch(() => ({}));
  const {
    required_permission, action,
    target_record_type, target_record_id,
    replay_path, replay_method, payload, reason,
  } = body;

  if (!required_permission && !action) {
    return NextResponse.json(
      { success: false, error: 'required_permission or action is required' },
      { status: 400 }
    );
  }

  const result = await query(
    `INSERT INTO approval_requests
       (requester_user_id, target_record_type, target_record_id,
        action_requested, reason, required_permission, denial_reason,
        replay_path, replay_method, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      auth.userId,
      target_record_type || 'action',
      target_record_id || null,
      action || required_permission,
      reason || null,
      required_permission || null,
      reason || null,
      replay_path || null,
      replay_method || null,
      JSON.stringify(payload || {}),
    ]
  );

  // Notify approvers: anyone with strictly higher authority than the
  // requester. We don't try to be clever about department scoping here —
  // the existing /api/approvals GET already filters by hierarchy.
  try {
    const requesterLevel = await getUserHierarchyLevel(auth.userId);
    const approverCandidates = await query(
      `SELECT DISTINCT u.id FROM users u
         LEFT JOIN staff s   ON s.id = u.staff_id
         LEFT JOIN staff_roles sr ON sr.staff_id = s.id
         LEFT JOIN roles r   ON r.id = sr.role_id
        WHERE u.is_active = TRUE
          AND (
            u.role = 'superadmin'
            OR (r.hierarchy_level IS NOT NULL AND r.hierarchy_level < $1)
          )
        LIMIT 50`,
      [requesterLevel]
    );
    if (approverCandidates.rows.length) {
      const values = approverCandidates.rows
        .map((_, i) => `($${i + 1}, $${approverCandidates.rows.length + 1}, $${approverCandidates.rows.length + 2}, $${approverCandidates.rows.length + 3}, $${approverCandidates.rows.length + 4})`)
        .join(',');
      await query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ${values}
         ON CONFLICT DO NOTHING`,
        [
          ...approverCandidates.rows.map(r => r.id),
          'approval_requested',
          'Approval requested',
          `${auth.userId} requested: ${action || required_permission}`,
          `/app/admin/approvals?id=${result.rows[0].id}`,
        ]
      ).catch(() => {});
    }
  } catch {/* notifications are non-fatal */}

  const meta = extractRbacMetadata(request);
  await logRbacEvent({
    userId: auth.userId,
    action: 'approval_request_submitted',
    entityType: 'approval_request',
    entityId: result.rows[0].id,
    details: { required_permission, action, replay_path, replay_method },
    ...meta,
  }).catch(() => {});

  return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
}
