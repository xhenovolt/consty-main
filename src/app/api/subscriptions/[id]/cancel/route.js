import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';

/**
 * POST /api/subscriptions/[id]/cancel
 *
 * Cancels a subscription immediately.
 * Status → 'cancelled', cancellation timestamp recorded.
 */
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'subscriptions.cancel');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { notes } = body;

    const result = await query(
      `UPDATE subscriptions
       SET status = 'cancelled',
           cancelled_at = NOW(),
           cancelled_by = $1,
           auto_renew   = FALSE
       WHERE id = $2 AND status NOT IN ('cancelled')
       RETURNING *`,
      [auth.userId, id]
    );

    if (!result.rows[0]) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found or already cancelled' },
        { status: 404 }
      );
    }

    await query(
      `INSERT INTO subscription_billing_history
         (subscription_id, amount, currency, event_type, period_start, period_end, notes, recorded_by)
       SELECT $1, 0, pc.currency, 'suspension', NOW()::DATE, s.end_date, $2, $3
       FROM subscriptions s
       JOIN pricing_cycles pc ON pc.id = s.pricing_cycle_id
       WHERE s.id = $1`,
      [id, notes || 'Subscription cancelled', auth.userId]
    );

    await dispatch('subscription.cancelled', { subscriptionId: id, actorId: auth.userId });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Subscriptions] cancel error:', error);
    return NextResponse.json({ success: false, error: 'Failed to cancel subscription' }, { status: 500 });
  }
}
