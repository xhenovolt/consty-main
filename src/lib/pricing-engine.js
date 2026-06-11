/**
 * Pricing engine — version-on-write helpers for pricing plans.
 *
 * The contract:
 *   - Editing a "structural" field (price/features/limits/support) snapshots a new version.
 *   - Editing cosmetic fields (description, display_order) does not.
 *   - Subscriptions are pinned to the version that was current when they were created.
 */

import { query } from './db.js';

const STRUCTURAL_FIELDS = new Set([
  'name', 'features', 'setup_fee', 'trial_days', 'grace_days',
  'max_users', 'max_students', 'sms_limit', 'support_tier',
  'deployment_type', 'implementation_complexity', 'onboarding_hours',
]);

export function isStructuralChange(changeBody) {
  return Object.keys(changeBody).some(k => STRUCTURAL_FIELDS.has(k));
}

export async function snapshotCurrentVersion(planId, actorId, reason) {
  const planRes = await query('SELECT * FROM pricing_plans WHERE id = $1', [planId]);
  if (!planRes.rows.length) throw new Error('Plan not found');
  const plan = planRes.rows[0];
  const cyclesRes = await query(
    `SELECT id, name, duration_days, price, currency, is_active
       FROM pricing_cycles WHERE plan_id = $1 ORDER BY duration_days`,
    [planId]
  );

  const newVersion = (plan.current_version || 1) + 1;

  await query('UPDATE pricing_plan_versions SET is_current = FALSE WHERE plan_id = $1', [planId]);

  const v = await query(
    `INSERT INTO pricing_plan_versions (
       plan_id, version, name, description, features,
       setup_fee, trial_days, grace_days, max_users, max_students, sms_limit,
       support_tier, deployment_type, implementation_complexity, onboarding_hours,
       cycles_snapshot, is_current, created_by
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,TRUE,$17
     ) RETURNING *`,
    [
      planId, newVersion, plan.name, plan.description, plan.features,
      plan.setup_fee, plan.trial_days, plan.grace_days, plan.max_users, plan.max_students, plan.sms_limit,
      plan.support_tier, plan.deployment_type, plan.implementation_complexity, plan.onboarding_hours,
      JSON.stringify(cyclesRes.rows),
      actorId,
    ]
  );

  await query('UPDATE pricing_plans SET current_version = $1 WHERE id = $2', [newVersion, planId]);

  await query(
    `INSERT INTO pricing_plan_changes (plan_id, from_version, to_version, change_type, reason, actor_id)
     VALUES ($1,$2,$3,'version_snapshot',$4,$5)`,
    [planId, plan.current_version || 1, newVersion, reason || null, actorId]
  );

  return v.rows[0];
}

export async function logPlanChange({ plan_id, from_version, to_version, change_type, field_changes, reason, actor_id }) {
  await query(
    `INSERT INTO pricing_plan_changes
       (plan_id, from_version, to_version, change_type, field_changes, reason, actor_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      plan_id, from_version || null, to_version || null, change_type,
      field_changes ? JSON.stringify(field_changes) : '{}', reason || null, actor_id || null,
    ]
  );
}

export async function logSubscriptionEvent({ subscription_id, event_type, actor_id, description, before_state, after_state, metadata }) {
  try {
    await query(
      `INSERT INTO subscription_events
         (subscription_id, event_type, actor_id, description, before_state, after_state, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        subscription_id, event_type, actor_id || null, description || null,
        before_state ? JSON.stringify(before_state) : null,
        after_state  ? JSON.stringify(after_state)  : null,
        metadata     ? JSON.stringify(metadata)     : '{}',
      ]
    );
  } catch (err) {
    console.error('[pricing-engine] logSubscriptionEvent failed:', err.message);
  }
}

export async function recordSubscriptionStatus({ subscription_id, from_status, to_status, reason, actor_id }) {
  try {
    await query(
      `INSERT INTO subscription_status_history (subscription_id, from_status, to_status, reason, actor_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [subscription_id, from_status || null, to_status, reason || null, actor_id || null]
    );
  } catch (err) {
    console.error('[pricing-engine] recordSubscriptionStatus failed:', err.message);
  }
}
