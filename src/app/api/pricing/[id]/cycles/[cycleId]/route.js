import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';

// PATCH /api/pricing/[id]/cycles/[cycleId] — update a cycle
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'pricing.update');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id, cycleId } = await params;
    const body = await request.json();
    const { name, duration_days, price, currency, is_active } = body;

    const setClauses = [];
    const values = [];

    if (name          !== undefined) { values.push(name);          setClauses.push(`name = $${values.length}`); }
    if (duration_days !== undefined) { values.push(duration_days); setClauses.push(`duration_days = $${values.length}`); }
    if (price         !== undefined) { values.push(price);         setClauses.push(`price = $${values.length}`); }
    if (currency      !== undefined) { values.push(currency);      setClauses.push(`currency = $${values.length}`); }
    if (is_active     !== undefined) { values.push(is_active);     setClauses.push(`is_active = $${values.length}`); }

    if (setClauses.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    values.push(cycleId);
    values.push(id);
    const result = await query(
      `UPDATE pricing_cycles SET ${setClauses.join(', ')}
       WHERE id = $${values.length - 1} AND plan_id = $${values.length}
       RETURNING *`,
      values
    );

    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Cycle not found' }, { status: 404 });
    }

    await dispatch('pricing.cycle_updated', { planId: id, cycleId, changes: body, actorId: auth.userId });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'Cycle name already exists for this plan' }, { status: 409 });
    }
    console.error('[PricingCycles] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update cycle' }, { status: 500 });
  }
}

// DELETE /api/pricing/[id]/cycles/[cycleId] — remove a cycle
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'pricing.delete');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id, cycleId } = await params;

    // Block deletion if active subscriptions reference this cycle
    const subCheck = await query(
      `SELECT COUNT(*) FROM subscriptions WHERE pricing_cycle_id = $1 AND status = 'active'`,
      [cycleId]
    );
    if (parseInt(subCheck.rows[0].count) > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete cycle with active subscriptions. Deactivate it instead.' },
        { status: 409 }
      );
    }

    const result = await query(
      `DELETE FROM pricing_cycles WHERE id = $1 AND plan_id = $2 RETURNING *`,
      [cycleId, id]
    );
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Cycle not found' }, { status: 404 });
    }

    await dispatch('pricing.cycle_deleted', { planId: id, cycleId, actorId: auth.userId });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[PricingCycles] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete cycle' }, { status: 500 });
  }
}
