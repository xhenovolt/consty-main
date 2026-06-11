import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/reports - Financial and business reports
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'reports.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';

    let data = {};

    if (type === 'overview' || type === 'all') {
      // Financial overview
      const [financial, accounts, monthly, pipeline, clients, budgets] = await Promise.all([
        query(`SELECT * FROM v_financial_summary`),
        query(`SELECT * FROM v_account_balances WHERE is_active = true ORDER BY balance DESC`),
        query(`SELECT * FROM v_monthly_financials LIMIT 12`),
        query(`SELECT * FROM v_prospect_pipeline`),
        query(`SELECT * FROM v_client_summary ORDER BY total_paid DESC LIMIT 10`),
        query(`SELECT * FROM v_budget_utilization WHERE is_active = true`),
      ]);

      data = {
        financial: financial.rows[0],
        accounts: accounts.rows,
        monthlyTrend: monthly.rows,
        pipeline: pipeline.rows,
        topClients: clients.rows,
        budgets: budgets.rows,
      };
    }

    if (type === 'revenue') {
      const revenue = await query(`
        SELECT 
          DATE_TRUNC('month', l.entry_date)::DATE as month,
          l.category,
          SUM(l.amount) as total
        FROM ledger l 
        WHERE l.amount > 0 AND l.source_type = 'payment'
        GROUP BY DATE_TRUNC('month', l.entry_date), l.category
        ORDER BY month DESC
      `);
      data.revenue = revenue.rows;
    }

    if (type === 'expenses') {
      const expenses = await query(`
        SELECT 
          e.category,
          COUNT(*) as count,
          SUM(e.amount) as total,
          AVG(e.amount) as average
        FROM expenses e WHERE e.status != 'void'
        GROUP BY e.category ORDER BY total DESC
      `);
      data.expensesByCategory = expenses.rows;
    }

    if (type === 'deals') {
      const deals = await query(`SELECT * FROM v_deal_payment_status ORDER BY total_amount DESC`);
      data.deals = deals.rows;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Reports] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
