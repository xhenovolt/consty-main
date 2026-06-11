/**
 * logEvent — Universal event emitter for the Consty event-driven architecture.
 *
 * Call this from any API route after a significant action occurs.
 * Failures are swallowed so they never break the main operation.
 *
 * Usage:
 *   import { logEvent } from '@/lib/events';
 *   await logEvent({ event_type: 'deal_created', entity_type: 'deal', entity_id: deal.id, description: '...', metadata: {}, created_by: auth.userId });
 */

import { query } from '@/lib/db.js';

/**
 * @param {Object} params
 * @param {string} params.event_type    - e.g. 'deal_created', 'payment_received'
 * @param {string} [params.entity_type] - e.g. 'deal', 'system', 'payment', 'issue'
 * @param {string} [params.entity_id]   - UUID of the affected entity
 * @param {string} [params.description] - Human-readable summary
 * @param {Object} [params.metadata]    - Any extra structured data
 * @param {string} [params.created_by]  - User UUID who triggered the event
 */
export async function logEvent({ event_type, entity_type, entity_id, description, metadata, created_by }) {
  try {
    await query(
      `INSERT INTO events (event_type, entity_type, entity_id, description, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        event_type,
        entity_type || null,
        entity_id   || null,
        description || null,
        metadata ? JSON.stringify(metadata) : '{}',
        created_by  || null,
      ]
    );
  } catch (err) {
    // Non-fatal — log but never break the calling operation
    console.error('[logEvent] Failed to write event:', event_type, err.message);
  }
}

/**
 * Convenience wrappers for common event types
 */
export const Events = {
  systemCreated:  (id, name, userId)             => logEvent({ event_type: 'system_created',   entity_type: 'system',  entity_id: id, description: `System created: ${name}`,              created_by: userId }),
  dealCreated:    (id, title, userId)            => logEvent({ event_type: 'deal_created',     entity_type: 'deal',    entity_id: id, description: `Deal created: ${title}`,                created_by: userId }),
  dealClosed:     (id, title, amount, curr, uid) => logEvent({ event_type: 'deal_closed',      entity_type: 'deal',    entity_id: id, description: `Deal closed: ${title}`,                metadata: { amount, currency: curr }, created_by: uid }),
  paymentReceived:(id, amount, curr, dealTitle, uid) => logEvent({ event_type: 'payment_received', entity_type: 'payment', entity_id: id, description: `Payment received: ${curr} ${Number(amount).toLocaleString()}${dealTitle ? ` for ${dealTitle}` : ''}`, metadata: { amount, currency: curr }, created_by: uid }),
  issueReported:  (id, title, systemId, userId)  => logEvent({ event_type: 'issue_reported',   entity_type: 'issue',   entity_id: id, description: `Issue reported: ${title}`,             metadata: { system_id: systemId }, created_by: userId }),
  issueFixed:     (id, title, systemId, userId)  => logEvent({ event_type: 'issue_fixed',      entity_type: 'issue',   entity_id: id, description: `Issue resolved: ${title}`,             metadata: { system_id: systemId }, created_by: userId }),
  licenseIssued:  (id, client, system, userId)   => logEvent({ event_type: 'license_issued',   entity_type: 'license', entity_id: id, description: `License issued to ${client} for ${system}`, created_by: userId }),
  staffAdded:     (id, name, role, userId)        => logEvent({ event_type: 'staff_added',      entity_type: 'staff',   entity_id: id, description: `Staff added: ${name} (${role})`,       created_by: userId }),
};
