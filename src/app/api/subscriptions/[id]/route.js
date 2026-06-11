import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';

// GET /api/subscriptions/[id]
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'subscriptions.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const result = await query(
      `SELECT
         s.*,
         c.company_name AS client_name, c.contact_name, c.email AS client_email,
         pp.name AS plan_name, pp.description AS plan_description, pp.features,
         pc.name AS cycle_name, pc.price, pc.currency, pc.duration_days,
         COALESCE(
           (SELECT json_agg(h ORDER BY h.recorded_at DESC)
            FROM subscription_billing_history h
            WHERE h.subscription_id = s.id),
           '[]'
         ) AS billing_history
       FROM subscriptions s
       JOIN clients c       ON c.id  = s.client_id
       JOIN pricing_plans pp ON pp.id = s.plan_id
       JOIN pricing_cycles pc ON pc.id = s.pricing_cycle_id
       WHERE s.id = $1`,
      [id]
    );

    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Subscriptions] GET [id] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch subscription' }, { status: 500 });
  }
}

// PATCH /api/subscriptions/[id] — update notes, auto_renew, status
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'subscriptions.update');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const body = await request.json();
    const { auto_renew, notes, status } = body;

    const setClauses = [];
    const values = [];

    if (auto_renew !== undefined) { values.push(auto_renew); setClauses.push(`auto_renew = $${values.length}`); }
    if (notes      !== undefined) { values.push(notes);      setClauses.push(`notes = $${values.length}`); }
    if (status     !== undefined) {
      const allowed = ['active', 'expired', 'suspended', 'cancelled', 'trial'];
      if (!allowed.includes(status)) {
        return NextResponse.json({ success: false, error: `status must be one of: ${allowed.join(', ')}` }, { status: 400 });
      }
      values.push(status); setClauses.push(`status = $${values.length}`);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    const result = await query(
      `UPDATE subscriptions SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 });
    }

    await dispatch('subscription.updated', { subscriptionId: id, changes: body, actorId: auth.userId });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Subscriptions] PATCH [id] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update subscription' }, { status: 500 });
  }
}
