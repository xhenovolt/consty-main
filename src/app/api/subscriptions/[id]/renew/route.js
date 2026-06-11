import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';

/**
 * POST /api/subscriptions/[id]/renew
 *
 * Renews a subscription by one billing cycle.
 * - Extends end_date by duration_days of the current cycle
 * - Sets status to 'active'
 * - Records a billing history event
 * - Optionally switches to a different pricing cycle (upgrade/downgrade)
 */
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'subscriptions.update');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { pricing_cycle_id: newCycleId, notes } = body;

    // Load current subscription
    const subRes = await query(
      `SELECT s.*, pc.duration_days, pc.price, pc.currency
       FROM subscriptions s
       JOIN pricing_cycles pc ON pc.id = s.pricing_cycle_id
       WHERE s.id = $1`,
      [id]
    );
    if (!subRes.rows[0]) {
      return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 });
    }

    const sub = subRes.rows[0];

    // If switching cycles (upgrade/downgrade) validate the new cycle
    let cycle = { duration_days: sub.duration_days, price: sub.price, currency: sub.currency, id: sub.pricing_cycle_id };
    let eventType = 'renewal';

    if (newCycleId && newCycleId !== sub.pricing_cycle_id) {
      const newCycleRes = await query(
        `SELECT * FROM pricing_cycles WHERE id = $1 AND plan_id = $2 AND is_active = TRUE`,
        [newCycleId, sub.plan_id]
      );
      if (!newCycleRes.rows[0]) {
        return NextResponse.json({ success: false, error: 'New pricing cycle not found or inactive' }, { status: 400 });
      }
      cycle = newCycleRes.rows[0];
      eventType = cycle.price > sub.price ? 'upgrade' : 'downgrade';
    }

    // New end_date is max(today, current end_date) + duration_days
    const baseDate = new Date(Math.max(new Date(), new Date(sub.end_date)));
    const newEndDate = new Date(baseDate);
    newEndDate.setDate(newEndDate.getDate() + cycle.duration_days);

    const newEndStr   = newEndDate.toISOString().split('T')[0];
    const periodStart = baseDate.toISOString().split('T')[0];

    const result = await query(
      `UPDATE subscriptions
       SET status = 'active',
           end_date = $1,
           pricing_cycle_id = $2
       WHERE id = $3
       RETURNING *`,
      [newEndStr, cycle.id, id]
    );

    // Record billing history
    await query(
      `INSERT INTO subscription_billing_history
         (subscription_id, amount, currency, event_type, period_start, period_end, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, cycle.price, cycle.currency, eventType, periodStart, newEndStr, notes || null, auth.userId]
    );

    await dispatch(`subscription.${eventType}`, {
      subscriptionId: id,
      newEndDate: newEndStr,
      cycleId: cycle.id,
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Subscriptions] renew error:', error);
    return NextResponse.json({ success: false, error: 'Failed to renew subscription' }, { status: 500 });
  }
}
