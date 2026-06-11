import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { logSubscriptionEvent, recordSubscriptionStatus } from '@/lib/pricing-engine.js';

export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'subscriptions.update');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const cur = await query('SELECT status, paused_at FROM subscriptions WHERE id = $1', [id]);
    if (!cur.rows.length) return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 });
    if (cur.rows[0].status !== 'paused')
      return NextResponse.json({ success: false, error: 'Subscription is not paused' }, { status: 409 });

    const r = await query(
      `UPDATE subscriptions
         SET status = 'active', resumed_at = NOW(), pause_reason = NULL
       WHERE id = $1 RETURNING *`,
      [id]
    );

    await query(
      `UPDATE subscription_pause_history
         SET resumed_at = NOW(), resumed_by = $1
       WHERE subscription_id = $2 AND resumed_at IS NULL`,
      [auth.userId, id]
    );
    await recordSubscriptionStatus({ subscription_id: id, from_status: 'paused', to_status: 'active', actor_id: auth.userId });
    await logSubscriptionEvent({
      subscription_id: id, event_type: 'resumed', actor_id: auth.userId,
      description: 'Subscription resumed',
    });

    return NextResponse.json({ success: true, data: r.rows[0] });
  } catch (e) {
    console.error('[Subscriptions] resume error:', e);
    return NextResponse.json({ success: false, error: 'Failed to resume subscription' }, { status: 500 });
  }
}
