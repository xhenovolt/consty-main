/**
 * System Logs — Centralised error/event logging
 *
 * Records errors, warnings, and critical events to the system_logs table.
 * Never throws — all failures are swallowed to prevent cascading errors.
 *
 * Usage:
 *   import { logError, logWarn, logInfo } from '@/lib/system-logs.js';
 *   await logError('licenses', 'auto_issue', 'License creation failed', { deal_id }, userId);
 */

import { query } from './db.js';

/**
 * Insert a row into system_logs.
 * @param {object} params
 * @param {'info'|'warn'|'error'|'critical'} params.level
 * @param {string} params.module     - e.g. 'licenses', 'operations', 'staff'
 * @param {string} params.action     - e.g. 'auto_issue', 'create', 'delete'
 * @param {string} params.message    - Human-readable description
 * @param {object} [params.details]  - Extra structured data (stored as JSONB)
 * @param {string} [params.userId]   - Acting user ID
 * @param {string} [params.entityType]
 * @param {string} [params.entityId]
 * @param {string} [params.ipAddress]
 */
async function log({ level = 'error', module, action, message, details = null, userId = null, entityType = null, entityId = null, ipAddress = null } = {}) {
  try {
    await query(
      `INSERT INTO system_logs (level, module, action, message, details, user_id, entity_type, entity_id, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        level,
        module   || null,
        action   || null,
        message,
        details  ? JSON.stringify(details) : null,
        userId   || null,
        entityType || null,
        entityId || null,
        ipAddress || null,
      ]
    );
  } catch (err) {
    // Last-resort — print to console so the log isn't lost entirely
    console.error('[system-logs] failed to write log:', err.message, { level, module, message });
  }
}

export const logInfo     = (module, action, message, details, userId, entityType, entityId) =>
  log({ level: 'info',     module, action, message, details, userId, entityType, entityId });

export const logWarn     = (module, action, message, details, userId, entityType, entityId) =>
  log({ level: 'warn',     module, action, message, details, userId, entityType, entityId });

export const logError    = (module, action, message, details, userId, entityType, entityId) =>
  log({ level: 'error',    module, action, message, details, userId, entityType, entityId });

export const logCritical = (module, action, message, details, userId, entityType, entityId) =>
  log({ level: 'critical', module, action, message, details, userId, entityType, entityId });

export default { log, logInfo, logWarn, logError, logCritical };
