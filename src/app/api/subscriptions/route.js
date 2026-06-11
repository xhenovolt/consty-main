import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';

// GET /api/subscriptions — list subscriptions
export async function GET(request) {
  const perm = await requirePermission(request, 'subscriptions.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { searchParams } = new URL(request.url);
    const client_id = searchParams.get('client_id');
    const system    = searchParams.get('system');
    const status    = searchParams.get('status');
    const page      = Math.max(1, parseInt(searchParams.get('page')  || '1'));
    const limit     = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));
    const offset    = (page - 1) * limit;

    const params = [];
    let where = 'WHERE 1=1';

    if (client_id) { params.push(client_id);          where += ` AND s.client_id = $${params.length}`; }
    if (system)    { params.push(system.toLowerCase()); where += ` AND s.system = $${params.length}`; }
    if (status)    { params.push(status);              where += ` AND s.status = $${params.length}`; }

    const sql = `
      SELECT
        s.*,
        c.company_name AS client_name,
        c.contact_name,
        pp.name        AS plan_name,
        pc.name        AS cycle_name,
        pc.price,
        pc.currency,
        pc.duration_days
      FROM subscriptions s
      JOIN clients c     ON c.id  = s.client_id
      JOIN pricing_plans pp ON pp.id = s.plan_id
      JOIN pricing_cycles pc ON pc.id = s.pricing_cycle_id
      ${where}
      ORDER BY s.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `SELECT COUNT(*) FROM subscriptions s ${where}`;

    const [result, countResult] = await Promise.all([
      query(sql, [...params, limit, offset]),
      query(countSql, params),
    ]);

    const total = parseInt(countResult.rows[0].count);
    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[Subscriptions] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

// POST /api/subscriptions — create a new subscription
export async function POST(request) {
  const perm = await requirePermission(request, 'subscriptions.create');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const body = await request.json();
    const { client_id, plan_id, pricing_cycle_id, start_date, auto_renew, notes } = body;

    if (!client_id)        return NextResponse.json({ success: false, error: 'client_id is required' },        { status: 400 });
    if (!plan_id)          return NextResponse.json({ success: false, error: 'plan_id is required' },          { status: 400 });
    if (!pricing_cycle_id) return NextResponse.json({ success: false, error: 'pricing_cycle_id is required' }, { status: 400 });

    // Fetch the cycle to compute end_date and system
    const cycleRes = await query(
      `SELECT pc.*, pp.system FROM pricing_cycles pc
       JOIN pricing_plans pp ON pp.id = pc.plan_id
       WHERE pc.id = $1 AND pc.plan_id = $2 AND pc.is_active = TRUE`,
      [pricing_cycle_id, plan_id]
    );
    if (!cycleRes.rows[0]) {
      return NextResponse.json({ success: false, error: 'Pricing cycle not found or inactive' }, { status: 400 });
    }

    const cycle = cycleRes.rows[0];
    const resolvedStart = start_date || new Date().toISOString().split('T')[0];
    const endDate = new Date(resolvedStart);
    endDate.setDate(endDate.getDate() + cycle.duration_days);

    const result = await query(
      `INSERT INTO subscriptions
         (client_id, plan_id, pricing_cycle_id, system, start_date, end_date, auto_renew, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        client_id,
        plan_id,
        pricing_cycle_id,
        cycle.system,
        resolvedStart,
        endDate.toISOString().split('T')[0],
        auto_renew !== false,
        notes || null,
        auth.userId,
      ]
    );

    // Record initial billing event
    await query(
      `INSERT INTO subscription_billing_history
         (subscription_id, amount, currency, event_type, period_start, period_end, recorded_by)
       VALUES ($1,$2,$3,'payment',$4,$5,$6)`,
      [
        result.rows[0].id,
        cycle.price,
        cycle.currency,
        resolvedStart,
        endDate.toISOString().split('T')[0],
        auth.userId,
      ]
    );

    await dispatch('subscription.created', {
      subscriptionId: result.rows[0].id,
      clientId: client_id,
      planId: plan_id,
      system: cycle.system,
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Subscriptions] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create subscription' }, { status: 500 });
  }
}
