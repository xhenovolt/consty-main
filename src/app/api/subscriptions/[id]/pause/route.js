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
    const { reason } = await request.json().catch(() => ({}));
    if (!reason || !reason.trim())
      return NextResponse.json({ success: false, error: 'Pause reason required' }, { status: 400 });

    const cur = await query('SELECT status FROM subscriptions WHERE id = $1', [id]);
    if (!cur.rows.length) return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 });
    if (cur.rows[0].status !== 'active')
      return NextResponse.json({ success: false, error: 'Only active subscriptions can be paused' }, { status: 409 });

    const r = await query(
      `UPDATE subscriptions
         SET status = 'paused', paused_at = NOW(), pause_reason = $1, resumed_at = NULL
       WHERE id = $2 RETURNING *`,
      [reason, id]
    );

    await query(
      `INSERT INTO subscription_pause_history (subscription_id, paused_at, reason, paused_by)
       VALUES ($1, NOW(), $2, $3)`,
      [id, reason, auth.userId]
    );
    await recordSubscriptionStatus({ subscription_id: id, from_status: cur.rows[0].status, to_status: 'paused', reason, actor_id: auth.userId });
    await logSubscriptionEvent({
      subscription_id: id, event_type: 'paused', actor_id: auth.userId,
      description: `Subscription paused: ${reason}`, metadata: { reason },
    });

    return NextResponse.json({ success: true, data: r.rows[0] });
  } catch (e) {
    console.error('[Subscriptions] pause error:', e);
    return NextResponse.json({ success: false, error: 'Failed to pause subscription' }, { status: 500 });
  }
}
