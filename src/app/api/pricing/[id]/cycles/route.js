import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';

// GET /api/pricing/[id]/cycles — list cycles for a plan
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'pricing.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const result = await query(
      `SELECT * FROM pricing_cycles WHERE plan_id = $1 ORDER BY duration_days`,
      [id]
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[PricingCycles] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch cycles' }, { status: 500 });
  }
}

// POST /api/pricing/[id]/cycles — add a cycle to a plan
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'pricing.update');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, duration_days, price, currency } = body;

    if (!name)          return NextResponse.json({ success: false, error: 'name is required' },          { status: 400 });
    if (!duration_days) return NextResponse.json({ success: false, error: 'duration_days is required' }, { status: 400 });
    if (price == null)  return NextResponse.json({ success: false, error: 'price is required' },         { status: 400 });

    // Verify the plan exists
    const plan = await query(`SELECT id, system FROM pricing_plans WHERE id = $1`, [id]);
    if (!plan.rows[0]) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    const result = await query(
      `INSERT INTO pricing_cycles (plan_id, name, duration_days, price, currency)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, name, duration_days, price, currency || 'UGX']
    );

    await dispatch('pricing.cycle_added', {
      planId: id,
      cycleId: result.rows[0].id,
      name,
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'A cycle with that name already exists for this plan' }, { status: 409 });
    }
    console.error('[PricingCycles] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create cycle' }, { status: 500 });
  }
}
