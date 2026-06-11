/**
 * Approval-prompt client helper.
 *
 * Wrap any mutating fetch in `withApprovalPrompt(...)` and a 403 with
 * `can_request_approval: true` will open a confirm dialog asking the user
 * to request approval from a manager. On confirm, posts the captured
 * context to /api/approvals/request and returns a `requestedApproval`
 * sentinel result so the caller knows the original action did NOT execute.
 *
 * Use this for medium-sensitivity actions (media upload to restricted
 * entities, document edits, etc.) — not for hard-deny actions like
 * superadmin-only operations.
 */

import { fetchWithAuth } from './fetch-client.js';

export async function withApprovalPrompt(url, options = {}, { actionLabel } = {}) {
  const res = await fetch(url, { ...options, credentials: 'include' });
  const data = await res.json().catch(() => ({}));

  if (res.ok) return { ok: true, data };

  if (res.status === 403 && data?.can_request_approval) {
    const ctx = data.approval_context || {};
    const confirmed = typeof window !== 'undefined'
      ? window.confirm(
          `${data.error || 'Permission denied.'}\n\n` +
          `Do you want to request approval from a manager to perform:\n  ` +
          `${actionLabel || ctx.action || ctx.required_permission}?`
        )
      : false;
    if (!confirmed) {
      return { ok: false, denied: true, error: data.error };
    }
    const reqRes = await fetchWithAuth('/api/approvals/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        required_permission: ctx.required_permission,
        action:              actionLabel || ctx.action,
        target_record_type:  ctx.target_record_type,
        target_record_id:    ctx.target_record_id,
        replay_path:         ctx.replay_path || url,
        replay_method:       ctx.replay_method || options.method || 'GET',
        payload:             ctx.payload || tryParseBody(options.body),
        reason:              ctx.reason,
      }),
    });
    return {
      ok: false,
      denied: true,
      requestedApproval: !!reqRes?.success,
      approval: reqRes?.data,
      error: reqRes?.success
        ? `Approval requested for "${actionLabel || ctx.action}".`
        : (reqRes?.error || 'Failed to submit approval request.'),
    };
  }

  return { ok: false, denied: false, error: data?.error || `HTTP ${res.status}`, data };
}

function tryParseBody(body) {
  if (!body) return null;
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return body; }
  }
  if (body instanceof FormData) {
    const obj = {};
    for (const [k, v] of body.entries()) obj[k] = typeof v === 'string' ? v : '[binary]';
    return obj;
  }
  return null;
}
