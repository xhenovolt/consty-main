import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/subscriptions/[id]/billing — billing history for a subscription
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'subscriptions.billing_view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;

    // Verify subscription exists
    const subCheck = await query(`SELECT id FROM subscriptions WHERE id = $1`, [id]);
    if (!subCheck.rows[0]) {
      return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 });
    }

    const result = await query(
      `SELECT h.*, u.name AS recorded_by_name
       FROM subscription_billing_history h
       LEFT JOIN users u ON u.id = h.recorded_by
       WHERE h.subscription_id = $1
       ORDER BY h.recorded_at DESC`,
      [id]
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Subscriptions] billing GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch billing history' }, { status: 500 });
  }
}
