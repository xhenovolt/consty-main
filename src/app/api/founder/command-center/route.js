import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * GET /api/founder/command-center — Aggregated metrics for founder dashboard
 * Returns financial, sales, operational, team, and system health metrics
 */
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'dashboard.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    // Run all metric queries in parallel
    const [
      revenueResult,
      pipelineResult,
      dealResult,
      teamResult,
      systemResult,
      recentEventsResult,
      pendingApprovalsResult,
      bugResult,
      decisionResult,
    ] = await Promise.all([
      // Financial: total revenue, expenses, outstanding
      query(`SELECT
        COALESCE(SUM(CASE WHEN type = 'income' OR type = 'payment' THEN amount ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses
        FROM transactions WHERE created_at >= NOW() - INTERVAL '30 days'`).catch(() => ({ rows: [{ total_revenue: 0, total_expenses: 0 }] })),

      // Pipeline: prospects by stage
      query(`SELECT stage, COUNT(*) as count FROM prospects WHERE status = 'active' GROUP BY stage`).catch(() => ({ rows: [] })),

      // Deals: active, won this month
      query(`SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_deals,
        COUNT(*) FILTER (WHERE status = 'won' AND created_at >= NOW() - INTERVAL '30 days') as won_this_month,
        COALESCE(SUM(total_value) FILTER (WHERE status = 'active'), 0) as pipeline_value
        FROM deals`).catch(() => ({ rows: [{ active_deals: 0, won_this_month: 0, pipeline_value: 0 }] })),

      // Team: staff counts
      query(`SELECT
        COUNT(*) as total_staff,
        COUNT(*) FILTER (WHERE status = 'active') as active_staff,
        COUNT(DISTINCT department) as dept_count
        FROM staff`).catch(() => ({ rows: [{ total_staff: 0, active_staff: 0, dept_count: 0 }] })),

      // Systems: active, total licenses
      query(`SELECT
        COUNT(*) as total_systems,
        (SELECT COUNT(*) FROM licenses WHERE status = 'active') as active_licenses
        FROM systems`).catch(() => ({ rows: [{ total_systems: 0, active_licenses: 0 }] })),

      // Recent activity (last 24h)
      query(`SELECT event_name, COUNT(*) as count
        FROM system_events WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY event_name ORDER BY count DESC LIMIT 10`).catch(() => ({ rows: [] })),

      // Pending approvals
      query(`SELECT COUNT(*) as pending FROM approval_requests WHERE status = 'pending'`).catch(() => ({ rows: [{ pending: 0 }] })),

      // Bugs: open, critical
      query(`SELECT
        COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) as open_bugs,
        COUNT(*) FILTER (WHERE severity = 'critical' AND status IN ('open', 'in_progress')) as critical_bugs
        FROM bug_reports`).catch(() => ({ rows: [{ open_bugs: 0, critical_bugs: 0 }] })),

      // Decisions this month
      query(`SELECT COUNT(*) as this_month FROM decision_logs WHERE decision_date >= DATE_TRUNC('month', CURRENT_DATE)`).catch(() => ({ rows: [{ this_month: 0 }] })),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        financial: {
          revenue_30d: parseFloat(revenueResult.rows[0]?.total_revenue || 0),
          expenses_30d: parseFloat(revenueResult.rows[0]?.total_expenses || 0),
        },
        pipeline: {
          stages: pipelineResult.rows,
          total_value: parseFloat(dealResult.rows[0]?.pipeline_value || 0),
        },
        deals: {
          active: parseInt(dealResult.rows[0]?.active_deals || 0),
          won_this_month: parseInt(dealResult.rows[0]?.won_this_month || 0),
        },
        team: {
          total: parseInt(teamResult.rows[0]?.total_staff || 0),
          active: parseInt(teamResult.rows[0]?.active_staff || 0),
          departments: parseInt(teamResult.rows[0]?.dept_count || 0),
        },
        systems: {
          total: parseInt(systemResult.rows[0]?.total_systems || 0),
          active_licenses: parseInt(systemResult.rows[0]?.active_licenses || 0),
        },
        activity: {
          events_24h: recentEventsResult.rows,
        },
        approvals: {
          pending: parseInt(pendingApprovalsResult.rows[0]?.pending || 0),
        },
        bugs: {
          open: parseInt(bugResult.rows[0]?.open_bugs || 0),
          critical: parseInt(bugResult.rows[0]?.critical_bugs || 0),
        },
        decisions: {
          this_month: parseInt(decisionResult.rows[0]?.this_month || 0),
        },
      },
    });
  } catch (error) {
    console.error('[CommandCenter] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
