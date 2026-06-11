import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/subscriptions/[id]/events — events + status history + pause history + cycles
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'subscriptions.view');
    if (perm instanceof NextResponse) return perm;

    const { id } = await params;

    const [events, statusHistory, pauseHistory, cycles] = await Promise.all([
      query(
        `SELECT e.*, u.full_name AS actor_name
         FROM subscription_events e
         LEFT JOIN users u ON e.actor_id = u.id
         WHERE e.subscription_id = $1
         ORDER BY e.created_at DESC LIMIT 100`,
        [id]
      ),
      query(
        `SELECT s.*, u.full_name AS actor_name
         FROM subscription_status_history s
         LEFT JOIN users u ON s.actor_id = u.id
         WHERE s.subscription_id = $1
         ORDER BY s.created_at DESC LIMIT 50`,
        [id]
      ),
      query(
        `SELECT p.*, u1.full_name AS paused_by_name, u2.full_name AS resumed_by_name
         FROM subscription_pause_history p
         LEFT JOIN users u1 ON p.paused_by  = u1.id
         LEFT JOIN users u2 ON p.resumed_by = u2.id
         WHERE p.subscription_id = $1
         ORDER BY p.paused_at DESC`,
        [id]
      ),
      query(
        `SELECT * FROM subscription_cycles
         WHERE subscription_id = $1
         ORDER BY cycle_number DESC LIMIT 50`,
        [id]
      ),
    ]);

    return NextResponse.json({
      success: true,
      events: events.rows,
      status_history: statusHistory.rows,
      pause_history: pauseHistory.rows,
      cycles: cycles.rows,
    });
  } catch (e) {
    console.error('[Subscriptions] events GET error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load events' }, { status: 500 });
  }
}
