import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/intelligence/dashboard — Role-based dashboard data
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'intelligence.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') || 'founder';

    const data = {};

    // Founder Dashboard — everything
    if (role === 'founder' || role === 'coo' || role === 'cfo' || role === 'cto') {
      // Revenue metrics
      const revenue = await query(`
        SELECT 
          COALESCE(SUM(amount), 0) as total_revenue,
          COALESCE(SUM(amount) FILTER (WHERE date_received >= date_trunc('month', CURRENT_DATE)), 0) as this_month,
          COALESCE(SUM(amount) FILTER (WHERE date_received >= date_trunc('year', CURRENT_DATE)), 0) as this_year,
          COUNT(*) as total_events
        FROM revenue_events
      `);
      data.revenue = revenue.rows[0];

      // Capital allocation breakdown
      const allocations = await query(`
        SELECT ra.category, COALESCE(SUM(ra.amount), 0) as total
        FROM revenue_allocations ra
        GROUP BY ra.category
      `);
      data.allocations = allocations.rows;
    }

    if (role === 'founder' || role === 'coo') {
      // Operations progress
      const operations = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE created_at >= date_trunc('week', CURRENT_DATE)) as this_week
        FROM operations
      `);
      data.operations = operations.rows[0];

      // Employee activity
      const employees = await query(`
        SELECT COUNT(*) as active_employees FROM employees WHERE employment_status = 'active'
      `);
      data.employees = employees.rows[0];

      // Deal pipeline
      const deals = await query(`
        SELECT 
          COUNT(*) as total_deals,
          COUNT(*) FILTER (WHERE status = 'in_progress') as active,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as completed_value
        FROM deals
      `);
      data.deals = deals.rows[0];
    }

    if (role === 'founder' || role === 'cfo') {
      // Budget tracking
      const budgets = await query(`
        SELECT category, expected_amount, current_amount, period 
        FROM budget_targets 
        ORDER BY category
      `);
      data.budgets = budgets.rows;

      // Expense summary
      const expenses = await query(`
        SELECT 
          COALESCE(SUM(amount), 0) as total_expenses,
          COALESCE(SUM(amount) FILTER (WHERE expense_date >= date_trunc('month', CURRENT_DATE)), 0) as this_month
        FROM expenses
      `);
      data.expenses = expenses.rows[0];

      // Invoice stats
      const invoices = await query(`
        SELECT 
          COUNT(*) as total_invoices,
          COALESCE(SUM(amount), 0) as total_invoiced,
          COUNT(*) FILTER (WHERE issued_date >= date_trunc('month', CURRENT_DATE)) as this_month_count
        FROM invoices WHERE status = 'paid'
      `);
      data.invoices = invoices.rows[0];
    }

    if (role === 'founder' || role === 'cto') {
      // System health
      const systems = await query(`SELECT COUNT(*) as total FROM systems`);
      data.systems = systems.rows[0];

      // Bug backlog
      const bugs = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'open') as open_count,
          COUNT(*) FILTER (WHERE severity = 'critical' AND status NOT IN ('resolved','closed')) as critical_open,
          AVG(EXTRACT(EPOCH FROM time_to_resolve)/3600) FILTER (WHERE time_to_resolve IS NOT NULL) as avg_resolution_hours
        FROM bug_reports
      `);
      data.bugs = bugs.rows[0];

      // Feature requests
      const features = await query(`
        SELECT 
          COUNT(*) FILTER (WHERE status IN ('proposed','approved')) as pending,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
          COUNT(*) FILTER (WHERE status = 'completed') as completed
        FROM feature_requests
      `);
      data.features = features.rows[0];

      // Developer activity 
      const devActivity = await query(`
        SELECT 
          COUNT(*) as total_activities,
          COUNT(*) FILTER (WHERE started_at >= date_trunc('week', CURRENT_DATE)) as this_week
        FROM developer_activity
      `);
      data.devActivity = devActivity.rows[0];
    }

    // Activity summary (all roles)
    const activity = await query(`
      SELECT event_name, COUNT(*) as count 
      FROM system_events 
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY event_name 
      ORDER BY count DESC 
      LIMIT 10
    `);
    data.recentActivity = activity.rows;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Intelligence Dashboard] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}
