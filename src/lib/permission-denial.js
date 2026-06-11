/**
 * Permission-denial helpers.
 *
 * When an API route detects that the user lacks a permission, it can either:
 *   - throw plain 403 (existing behaviour, for hard-gated actions), or
 *   - return a 403 with `can_request_approval: true` and metadata that the
 *     client uses to offer the user a "Request approval" prompt.
 *
 * The /api/approvals/request endpoint then takes that metadata and creates
 * an approval_requests row with the full payload captured, so the approver
 * can review and replay the action.
 */

import { NextResponse } from 'next/server';

/**
 * Build a 403 response that the client can convert into a "request approval"
 * prompt. The action payload is echoed back so the client can resend it to
 * /api/approvals/request without re-collecting form input.
 */
export function denyWithApproval({
  required_permission,
  action,               // human-readable, e.g. "Upload restricted media"
  target_record_type,
  target_record_id,
  replay_path,
  replay_method,
  payload,
  reason,
}) {
  return NextResponse.json(
    {
      success: false,
      error: reason || 'You do not have permission for this action.',
      can_request_approval: true,
      approval_context: {
        required_permission,
        action: action || required_permission,
        target_record_type: target_record_type || null,
        target_record_id:   target_record_id   || null,
        replay_path:        replay_path        || null,
        replay_method:      replay_method      || null,
        payload:            payload            || null,
        reason:             reason             || null,
      },
    },
    { status: 403 }
  );
}
