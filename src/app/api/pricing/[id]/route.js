import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';
import { isStructuralChange, snapshotCurrentVersion, logPlanChange } from '@/lib/pricing-engine.js';

// GET /api/pricing/[id] — get single plan with cycles
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'pricing.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const result = await query(
      `SELECT
         pp.id, pp.name, pp.system, pp.description, pp.features,
         pp.is_active, pp.display_order, pp.created_at, pp.updated_at,
         COALESCE(
           json_agg(
             json_build_object(
               'id',            pc.id,
               'name',          pc.name,
               'duration_days', pc.duration_days,
               'price',         pc.price,
               'currency',      pc.currency,
               'is_active',     pc.is_active
             ) ORDER BY pc.duration_days
           ) FILTER (WHERE pc.id IS NOT NULL),
           '[]'
         ) AS pricing_cycles
       FROM pricing_plans pp
       LEFT JOIN pricing_cycles pc ON pc.plan_id = pp.id
       WHERE pp.id = $1
       GROUP BY pp.id`,
      [id]
    );

    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Pricing] GET [id] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch plan' }, { status: 500 });
  }
}

// PATCH /api/pricing/[id] — update plan
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'pricing.update');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const body = await request.json();
    const allowed = [
      'name', 'system', 'description', 'features', 'display_order', 'is_active',
      'setup_fee', 'trial_days', 'grace_days', 'max_users', 'max_students', 'sms_limit',
      'support_tier', 'deployment_type', 'implementation_complexity', 'onboarding_hours',
    ];

    const before = await query('SELECT * FROM pricing_plans WHERE id = $1', [id]);
    if (!before.rows[0]) return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });

    const setClauses = [];
    const values = [];
    const fieldChanges = {};
    for (const k of allowed) {
      if (body[k] === undefined) continue;
      const v = k === 'system' ? body[k].toLowerCase() : k === 'features' ? JSON.stringify(body[k]) : body[k];
      values.push(v);
      setClauses.push(`${k} = $${values.length}`);
      fieldChanges[k] = { from: before.rows[0][k], to: body[k] };
    }
    if (setClauses.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    const result = await query(
      `UPDATE pricing_plans SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    // Snapshot a new version when structural fields change
    let newVersion = null;
    if (isStructuralChange(body)) {
      try {
        const v = await snapshotCurrentVersion(id, auth.userId, body.version_reason || 'Plan updated');
        newVersion = v.version;
      } catch (e) {
        console.error('[Pricing] snapshot failed:', e.message);
      }
    }

    await logPlanChange({
      plan_id: id,
      from_version: before.rows[0].current_version || 1,
      to_version: newVersion || before.rows[0].current_version || 1,
      change_type: newVersion ? 'structural_update' : 'cosmetic_update',
      field_changes: fieldChanges,
      reason: body.version_reason,
      actor_id: auth.userId,
    });

    await dispatch('pricing.plan_updated', { planId: id, changes: body, version: newVersion, actorId: auth.userId });

    return NextResponse.json({ success: true, data: result.rows[0], new_version: newVersion });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'Plan name already exists for this system' }, { status: 409 });
    }
    console.error('[Pricing] PATCH [id] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update plan' }, { status: 500 });
  }
}

// DELETE /api/pricing/[id] — soft-delete (deactivate) or hard delete if no subscriptions
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'pricing.delete');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;

    // Check for active subscriptions
    const subCheck = await query(
      `SELECT COUNT(*) FROM subscriptions WHERE plan_id = $1 AND status = 'active'`,
      [id]
    );
    if (parseInt(subCheck.rows[0].count) > 0) {
      // Soft-delete: deactivate only
      const result = await query(
        `UPDATE pricing_plans SET is_active = FALSE WHERE id = $1 RETURNING id, name, system`,
        [id]
      );
      if (!result.rows[0]) {
        return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
      }
      await dispatch('pricing.plan_deactivated', { planId: id, actorId: auth.userId, reason: 'active_subscriptions' });
      return NextResponse.json({ success: true, data: result.rows[0], message: 'Plan deactivated (has active subscriptions)' });
    }

    const result = await query(
      `DELETE FROM pricing_plans WHERE id = $1 RETURNING id, name, system`,
      [id]
    );
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    await dispatch('pricing.plan_deleted', { planId: id, actorId: auth.userId });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Pricing] DELETE [id] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete plan' }, { status: 500 });
  }
}
