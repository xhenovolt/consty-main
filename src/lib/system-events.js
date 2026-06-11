/**
 * Consty System Event Dispatcher
 *
 * Central event system that powers notifications, activity logs, and analytics.
 * Every meaningful action in Consty triggers a system event which automatically
 * generates notifications for relevant users.
 *
 * Usage:
 *   import { dispatch } from '@/lib/system-events';
 *   await dispatch('deal_created', { entityType: 'deal', entityId: deal.id, description: '...', metadata: {...}, actorId: auth.userId });
 */

import { query, getPool } from '@/lib/db.js';

/**
 * Dispatch a system event and generate notifications.
 * Non-fatal — errors are logged but never break the calling operation.
 */
export async function dispatch(eventName, { entityType, entityId, description, metadata, actorId } = {}) {
  try {
    const result = await query(
      `INSERT INTO system_events (event_name, actor_user_id, entity_type, entity_id, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [eventName, actorId || null, entityType || null, entityId || null, description || null, metadata ? JSON.stringify(metadata) : '{}']
    );
    const eventId = result.rows[0]?.id;

    // Fire-and-forget notification generation
    if (eventId) {
      generateNotifications(eventId, eventName, { entityType, entityId, description, metadata, actorId }).catch(err => {
        console.error('[SystemEvents] Notification generation failed:', err.message);
      });
    }

    return eventId;
  } catch (err) {
    console.error('[SystemEvents] Failed to dispatch event:', eventName, err.message);
    return null;
  }
}

/**
 * Generate notifications for an event.
 * Notifies all admin/superadmin users except the actor.
 */
async function generateNotifications(eventId, eventName, { entityType, entityId, description, metadata, actorId }) {
  try {
    // Get notification config for this event type
    const config = NOTIFICATION_MAP[eventName];
    if (!config) return;

    // Get actor name
    let actorName = 'Someone';
    if (actorId) {
      try {
        const u = await query(`SELECT name, full_name, email FROM users WHERE id = $1`, [actorId]);
        if (u.rows[0]) actorName = u.rows[0].name || u.rows[0].full_name || u.rows[0].email;
      } catch {}
    }

    const title = config.title(actorName, metadata || {});
    const message = description || config.message(actorName, metadata || {});
    const type = config.type || 'info';

    // Notify all active users — include the actor for founder/single-user setups
    const recipients = await query(
      `SELECT id FROM users WHERE is_active = true LIMIT 50`,
      []
    );

    if (recipients.rows.length === 0) return;

    const values = recipients.rows.map((_, i) => {
      const offset = i * 7;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
    }).join(', ');

    const params = recipients.rows.flatMap(r => [
      eventId, r.id, actorId || null, type, title, message, entityType
    ]);

    // Batch insert with reference_id appended
    const insertSql = `INSERT INTO notifications (event_id, recipient_user_id, actor_user_id, type, title, message, reference_type${entityId ? ', reference_id' : ''})
      VALUES ${recipients.rows.map((_, i) => {
        const offset = i * (entityId ? 8 : 7);
        const cols = entityId ? 8 : 7;
        return `(${Array.from({ length: cols }, (_, j) => `$${offset + j + 1}`).join(', ')})`;
      }).join(', ')}`;

    const insertParams = recipients.rows.flatMap(r => {
      const base = [eventId, r.id, actorId || null, type, title, message, entityType];
      if (entityId) base.push(entityId);
      return base;
    });

    await query(insertSql, insertParams);
  } catch (err) {
    console.error('[SystemEvents] generateNotifications error:', err.message);
  }
}

/**
 * Notification configuration map.
 * Each event type defines how to generate notification title/message.
 */
const NOTIFICATION_MAP = {
  prospect_created: {
    type: 'info',
    title: (actor, m) => `New Prospect`,
    message: (actor, m) => `${actor} created prospect: ${m.name || 'Unknown'}`,
  },
  prospect_updated: {
    type: 'info',
    title: (actor) => `Prospect Updated`,
    message: (actor, m) => `${actor} updated prospect: ${m.name || 'Unknown'}`,
  },
  prospect_converted: {
    type: 'success',
    title: (actor) => `Prospect Converted`,
    message: (actor, m) => `${actor} converted prospect ${m.name || ''} to client`,
  },
  deal_created: {
    type: 'info',
    title: (actor) => `New Deal`,
    message: (actor, m) => `${actor} created deal: ${m.title || 'Unknown'}`,
  },
  deal_updated: {
    type: 'info',
    title: (actor) => `Deal Updated`,
    message: (actor, m) => `${actor} updated deal: ${m.title || 'Unknown'}`,
  },
  deal_closed: {
    type: 'success',
    title: (actor) => `Deal Completed`,
    message: (actor, m) => `${actor} closed deal: ${m.title || ''} for ${m.currency || ''} ${Number(m.amount || 0).toLocaleString()}`,
  },
  deal_payment_recorded: {
    type: 'success',
    title: (actor) => `Payment Received`,
    message: (actor, m) => `${actor} recorded ${m.currency || 'UGX'} ${Number(m.amount || 0).toLocaleString()} payment${m.deal_title ? ` for ${m.deal_title}` : ''}`,
  },
  payment_received: {
    type: 'success',
    title: (actor) => `Payment Received`,
    message: (actor, m) => `${actor} recorded payment of ${m.currency || 'UGX'} ${Number(m.amount || 0).toLocaleString()}`,
  },
  expense_recorded: {
    type: 'warning',
    title: (actor) => `Expense Recorded`,
    message: (actor, m) => `${actor} recorded expense: ${m.currency || 'UGX'} ${Number(m.amount || 0).toLocaleString()} — ${m.description || m.category || ''}`,
  },
  operation_created: {
    type: 'info',
    title: (actor) => `Operation Created`,
    message: (actor, m) => `${actor} created operation: ${m.title || m.description || ''}`,
  },
  asset_added: {
    type: 'info',
    title: (actor) => `Asset Added`,
    message: (actor, m) => `${actor} added asset: ${m.name || ''}`,
  },
  system_created: {
    type: 'info',
    title: (actor) => `System Created`,
    message: (actor, m) => `${actor} created system: ${m.name || ''}`,
  },
  license_issued: {
    type: 'success',
    title: (actor) => `License Issued`,
    message: (actor, m) => `${actor} issued license for ${m.system || ''} to ${m.client || ''}`,
  },
  staff_added: {
    type: 'info',
    title: (actor) => `Staff Added`,
    message: (actor, m) => `${actor} added staff: ${m.name || ''} (${m.role || ''})`,
  },
  staff_created: {
    type: 'info',
    title: (actor) => `Staff Added`,
    message: (actor, m) => `${actor} added staff member: ${m.name || ''} (${m.position || m.role || ''})`,
  },
  client_created: {
    type: 'info',
    title: (actor) => `New Client`,
    message: (actor, m) => `${actor} created client: ${m.name || ''}`,
  },
  transfer_completed: {
    type: 'info',
    title: (actor) => `Transfer Completed`,
    message: (actor, m) => `${actor} transferred ${m.currency || 'UGX'} ${Number(m.amount || 0).toLocaleString()}`,
  },
  user_logged_in: {
    type: 'info',
    title: (actor) => `User Login`,
    message: (actor) => `${actor} logged into the system`,
  },
  invoice_created: {
    type: 'success',
    title: (actor) => `Invoice Generated`,
    message: (actor, m) => `${actor} generated invoice ${m.invoice_number || ''} for ${m.currency || 'UGX'} ${Number(m.amount || 0).toLocaleString()} — ${m.client_name || ''}`,
  },
  invoice_viewed: {
    type: 'info',
    title: (actor) => `Invoice Viewed`,
    message: (actor, m) => `${actor} viewed invoice ${m.invoice_number || ''}`,
  },
  invoice_downloaded: {
    type: 'info',
    title: (actor) => `Invoice Downloaded`,
    message: (actor, m) => `${actor} downloaded invoice ${m.invoice_number || ''}`,
  },
  bug_reported: {
    type: 'warning',
    title: (actor) => `Bug Reported`,
    message: (actor, m) => `${actor} reported ${m.severity || ''} bug: ${m.title || ''} in ${m.system_name || 'system'}`,
  },
  feature_requested: {
    type: 'info',
    title: (actor) => `Feature Requested`,
    message: (actor, m) => `${actor} requested feature: ${m.feature_title || ''}`,
  },
  revenue_recorded: {
    type: 'success',
    title: (actor) => `Revenue Recorded`,
    message: (actor, m) => `${actor} recorded ${m.source_type || ''} revenue of ${Number(m.amount || 0).toLocaleString()}`,
  },
  employee_added: {
    type: 'info',
    title: (actor) => `Employee Added`,
    message: (actor, m) => `${actor} added ${m.first_name || ''} ${m.last_name || ''} as ${m.position || 'employee'}`,
  },
  department_created: {
    type: 'success',
    title: (actor) => `Department Created`,
    message: (actor, m) => `${actor} created department: ${m.name || 'Unknown'}`,
  },
  department_updated: {
    type: 'info',
    title: (actor) => `Department Updated`,
    message: (actor, m) => `${actor} updated department: ${m.name || 'Unknown'}`,
  },
  department_deleted: {
    type: 'warning',
    title: (actor) => `Department Deactivated`,
    message: (actor, m) => `${actor} deactivated department: ${m.name || ''}`,
  },
  role_created: {
    type: 'info',
    title: (actor) => `Role Created`,
    message: (actor, m) => `${actor} created role: ${m.name || 'Unknown'}`,
  },
  role_updated: {
    type: 'info',
    title: (actor) => `Role Updated`,
    message: (actor, m) => `${actor} updated role: ${m.name || 'Unknown'}`,
  },
  approval_requested: {
    type: 'warning',
    title: (actor) => `Approval Requested`,
    message: (actor, m) => `${actor} requested approval for ${m.type || 'item'}: ${m.title || ''}`,
  },
  approval_granted: {
    type: 'success',
    title: (actor) => `Approval Granted`,
    message: (actor, m) => `${actor} approved ${m.type || 'item'}: ${m.title || ''}`,
  },
  staff_fired: {
    type: 'warning',
    title: (actor) => `Staff Terminated`,
    message: (actor, m) => `${actor} terminated staff member: ${m.name || ''}`,
  },
  backup_completed: {
    type: 'success',
    title: (actor) => `Backup Completed`,
    message: (actor, m) => `System backup completed successfully${m.size ? ` (${m.size})` : ''}`,
  },
};

/**
 * Transaction wrapper — run multiple operations atomically.
 * If any step fails, rolls back the entire transaction.
 *
 * Usage:
 *   const result = await withTransaction(async (client) => {
 *     await client.query('INSERT INTO deals ...', [...]);
 *     await client.query('INSERT INTO payments ...', [...]);
 *     return deal;
 *   });
 */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Log a system health event.
 */
export async function logHealth(component, status, errorMessage, metadata) {
  try {
    await query(
      `INSERT INTO system_health_logs (component, status, error_message, metadata) VALUES ($1, $2, $3, $4)`,
      [component, status, errorMessage || null, metadata ? JSON.stringify(metadata) : '{}']
    );
  } catch (err) {
    console.error('[SystemHealth] Failed to log:', err.message);
  }
}

/**
 * Check and consume an idempotency key.
 * Returns cached response if key was already used, null if new.
 */
export async function checkIdempotency(key, userId) {
  if (!key) return null;
  try {
    const existing = await query(
      `SELECT response FROM idempotency_keys WHERE key = $1 AND user_id = $2`,
      [key, userId]
    );
    if (existing.rows[0]) return existing.rows[0].response;
    return null;
  } catch {
    return null;
  }
}

/**
 * Store an idempotency key with its response.
 */
export async function storeIdempotency(key, userId, response) {
  if (!key) return;
  try {
    await query(
      `INSERT INTO idempotency_keys (key, user_id, response) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET response = $3`,
      [key, userId, JSON.stringify(response)]
    );
  } catch {}
}
