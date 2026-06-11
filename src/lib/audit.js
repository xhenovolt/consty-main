/**
 * Audit logging utility
 * Logs events to the audit_logs table
 */
import { query } from '@/lib/db.js';

/**
 * Log an authentication event
 * Accepts either positional args or a single options object:
 *   logAuthEvent(action, userId, details, metadata)
 *   logAuthEvent({ action, userId, email, reason, requestMetadata })
 */
export async function logAuthEvent(actionOrOpts, userId, details = {}, metadata = {}) {
  try {
    let action, resolvedUserId, resolvedDetails;

    if (typeof actionOrOpts === 'object' && actionOrOpts !== null) {
      // Object-style call
      action = actionOrOpts.action || 'UNKNOWN';
      resolvedUserId = actionOrOpts.userId || null;
      resolvedDetails = {
        email: actionOrOpts.email,
        reason: actionOrOpts.reason,
        ...(actionOrOpts.requestMetadata || {}),
      };
    } else {
      // Positional-style call
      action = String(actionOrOpts).slice(0, 100);
      resolvedUserId = userId || null;
      resolvedDetails = { ...details, ...metadata };
    }

    // Truncate action to 100 chars to avoid VARCHAR(100) overflow
    action = String(action).slice(0, 100);

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [resolvedUserId, action, 'session', resolvedUserId, JSON.stringify(resolvedDetails)]
    );
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

/**
 * Log a route access event
 */
export async function logRouteAccess(routeOrOpts, userId, metadata = {}) {
  let route, resolvedUserId;

  if (typeof routeOrOpts === 'object' && routeOrOpts !== null) {
    route = routeOrOpts.route || 'unknown';
    resolvedUserId = routeOrOpts.userId || userId || undefined;
  } else {
    route = routeOrOpts;
    resolvedUserId = userId;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[AUDIT] Route access: ${route} by user ${resolvedUserId}`);
  }
}

/**
 * Extract request metadata for audit logging
 */
export function extractRequestMetadata(request) {
  return {
    ip: request.headers?.get('x-forwarded-for') || request.headers?.get('x-real-ip') || 'unknown',
    userAgent: request.headers?.get('user-agent') || 'unknown',
    url: request.url || '',
  };
}
