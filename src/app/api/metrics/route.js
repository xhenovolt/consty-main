import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/metrics — System metrics computed from events + tables
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'reports.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    const [
      prospectsToday, dealsThisWeek, paymentsThisWeek, expensesThisWeek,
      activeUsers, recentEvents, totalCounts
    ] = await Promise.all([
      query(`SELECT COUNT(*) as count FROM prospects WHERE created_at >= $1::date`, [today]),
      query(`SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total FROM deals WHERE created_at >= $1::date`, [weekAgo]),
      query(`SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM payments WHERE created_at >= $1::date AND status = 'completed'`, [weekAgo]),
      query(`SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM expenses WHERE created_at >= $1::date`, [weekAgo]),
      query(`SELECT COUNT(*) as count FROM users WHERE is_active = true`),
      query(`SELECT event_name, COUNT(*) as count FROM system_events WHERE created_at >= $1::date GROUP BY event_name ORDER BY count DESC LIMIT 10`, [weekAgo]),
      query(`SELECT
        (SELECT COUNT(*) FROM prospects) as total_prospects,
        (SELECT COUNT(*) FROM deals) as total_deals,
        (SELECT COUNT(*) FROM clients) as total_clients,
        (SELECT COUNT(*) FROM payments) as total_payments,
        (SELECT COUNT(*) FROM operations) as total_operations`),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        today: {
          prospects_created: parseInt(prospectsToday.rows[0]?.count || 0),
        },
        this_week: {
          deals_created: parseInt(dealsThisWeek.rows[0]?.count || 0),
          deals_value: parseFloat(dealsThisWeek.rows[0]?.total || 0),
          payments_received: parseInt(paymentsThisWeek.rows[0]?.count || 0),
          payments_total: parseFloat(paymentsThisWeek.rows[0]?.total || 0),
          expenses_count: parseInt(expensesThisWeek.rows[0]?.count || 0),
          expenses_total: parseFloat(expensesThisWeek.rows[0]?.total || 0),
        },
        totals: {
          prospects: parseInt(totalCounts.rows[0]?.total_prospects || 0),
          deals: parseInt(totalCounts.rows[0]?.total_deals || 0),
          clients: parseInt(totalCounts.rows[0]?.total_clients || 0),
          payments: parseInt(totalCounts.rows[0]?.total_payments || 0),
          operations: parseInt(totalCounts.rows[0]?.total_operations || 0),
        },
        active_users: parseInt(activeUsers.rows[0]?.count || 0),
        event_breakdown: recentEvents.rows,
      },
    });
  } catch (error) {
    console.error('[Metrics] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
