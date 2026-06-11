import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { logSubscriptionEvent } from '@/lib/pricing-engine.js';

// Body: { new_plan_id, new_pricing_cycle_id, reason, prorate? }
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'subscriptions.update');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { new_plan_id, new_pricing_cycle_id, reason } = body;

    if (!new_plan_id || !new_pricing_cycle_id)
      return NextResponse.json({ success: false, error: 'new_plan_id and new_pricing_cycle_id required' }, { status: 400 });

    const cycleRes = await query(
      `SELECT pc.*, pp.system FROM pricing_cycles pc
       JOIN pricing_plans pp ON pp.id = pc.plan_id
       WHERE pc.id = $1 AND pc.plan_id = $2 AND pc.is_active = TRUE`,
      [new_pricing_cycle_id, new_plan_id]
    );
    if (!cycleRes.rows[0])
      return NextResponse.json({ success: false, error: 'Pricing cycle not found' }, { status: 400 });

    const before = await query('SELECT * FROM subscriptions WHERE id = $1', [id]);
    if (!before.rows.length) return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 });

    const versionRes = await query(
      `SELECT id FROM pricing_plan_versions WHERE plan_id = $1 AND is_current = TRUE`,
      [new_plan_id]
    );
    const newVersionId = versionRes.rows[0]?.id || null;

    const r = await query(
      `UPDATE subscriptions
         SET plan_id = $1, pricing_cycle_id = $2, plan_version_id = $3, system = $4
       WHERE id = $5 RETURNING *`,
      [new_plan_id, new_pricing_cycle_id, newVersionId, cycleRes.rows[0].system, id]
    );

    await logSubscriptionEvent({
      subscription_id: id, event_type: 'upgraded', actor_id: auth.userId,
      description: 'Subscription upgraded',
      before_state: { plan_id: before.rows[0].plan_id, pricing_cycle_id: before.rows[0].pricing_cycle_id },
      after_state: { plan_id: new_plan_id, pricing_cycle_id: new_pricing_cycle_id },
      metadata: { reason },
    });

    return NextResponse.json({ success: true, data: r.rows[0] });
  } catch (e) {
    console.error('[Subscriptions] upgrade error:', e);
    return NextResponse.json({ success: false, error: 'Failed to upgrade subscription' }, { status: 500 });
  }
}
