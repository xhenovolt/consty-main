import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission, buildDataScopeFilter } from '@/lib/permissions.js';

// ─── Widget fetchers ─────────────────────────────────────────────────────────

async function widgetPipelineSummary({ userId, dataScope, departmentId }) {
  const filter = buildDataScopeFilter({ dataScope, userId, departmentId, tableAlias: 'p', paramOffset: 0 });
  const params = [...filter.params];
  const { rows } = await query(
    `SELECT stage, COUNT(*) as count, COALESCE(SUM(estimated_value), 0) as total_value
     FROM prospects p WHERE stage NOT IN ('won','lost')${filter.clause}
     GROUP BY stage
     ORDER BY CASE stage WHEN 'new' THEN 1 WHEN 'contacted' THEN 2 WHEN 'qualified' THEN 3
       WHEN 'proposal' THEN 4 WHEN 'negotiation' THEN 5 ELSE 6 END`,
    params
  );
  return rows;
}

async function widgetRecentDeals({ userId, dataScope, departmentId }) {
  const filter = buildDataScopeFilter({ dataScope, userId, departmentId, tableAlias: 'd', paramOffset: 0 });
  const params = [...filter.params, 8];
  const { rows } = await query(
    `SELECT d.id, d.title, d.total_amount, d.status, d.created_at, d.due_date
     FROM deals d WHERE 1=1${filter.clause}
     ORDER BY d.created_at DESC LIMIT $${params.length}`,
    params
  );
  return rows;
}

async function widgetDealSummary({ userId, dataScope, departmentId }) {
  const filter = buildDataScopeFilter({ dataScope, userId, departmentId, tableAlias: 'd', paramOffset: 0 });
  const params = [...filter.params];
  const { rows } = await query(
    `WITH dp AS (
       SELECT d.status, d.total_amount, d.due_date,
         COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.deal_id = d.id AND p.status = 'completed'), 0) AS paid_amount
       FROM deals d WHERE 1=1${filter.clause}
     )
     SELECT
       COUNT(*) FILTER (WHERE status IN ('draft','sent','accepted','in_progress')) as active_deals,
       COALESCE(SUM(total_amount) FILTER (WHERE status IN ('draft','sent','accepted','in_progress')), 0) as active_value,
       COUNT(*) FILTER (WHERE status = 'completed') as completed_deals,
       COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as completed_value,
       COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('completed','cancelled')) as overdue_deals,
       COALESCE(SUM(total_amount - paid_amount) FILTER (WHERE status IN ('draft','sent','accepted','in_progress')), 0) as outstanding_balance
     FROM dp`,
    params
  );
  return rows[0] || { active_deals: 0, active_value: 0, completed_deals: 0, completed_value: 0, overdue_deals: 0, outstanding_balance: 0 };
}

async function widgetUpcomingFollowups({ userId, dataScope, departmentId }) {
  const filter = buildDataScopeFilter({ dataScope, userId, departmentId, tableAlias: 'f', createdByCol: 'created_by', paramOffset: 0 });
  const params = [...filter.params];
  const { rows } = await query(
    `SELECT f.id, f.type, f.status, f.scheduled_at, f.summary, p.company_name as prospect_name
     FROM followups f JOIN prospects p ON f.prospect_id = p.id
     WHERE f.status = 'scheduled' AND f.scheduled_at >= NOW()${filter.clause}
     ORDER BY f.scheduled_at ASC LIMIT 10`,
    params
  );
  return rows;
}

async function widgetMyProspects({ userId, dataScope, departmentId }) {
  const filter = buildDataScopeFilter({ dataScope, userId, departmentId, tableAlias: 'p', paramOffset: 0 });
  const params = [...filter.params];
  const { rows } = await query(
    `SELECT p.id, p.company_name, p.stage, p.estimated_value, p.created_at
     FROM prospects p WHERE 1=1${filter.clause}
     ORDER BY p.created_at DESC LIMIT 10`,
    params
  );
  return rows;
}

async function widgetFinancialSummary() {
  try {
    const { rows } = await query(`SELECT * FROM v_financial_summary`);
    return rows[0] || { total_income: 0, total_expenses: 0, net_position: 0 };
  } catch { return { total_income: 0, total_expenses: 0, net_position: 0 }; }
}

async function widgetAccountBalances() {
  try {
    const { rows } = await query(`SELECT * FROM v_account_balances WHERE is_active = true ORDER BY balance DESC`);
    return rows;
  } catch { return []; }
}

async function widgetRecentExpenses({ userId, dataScope, departmentId }) {
  const filter = buildDataScopeFilter({ dataScope, userId, departmentId, tableAlias: 'e', paramOffset: 0 });
  const params = [...filter.params];
  const { rows } = await query(
    `SELECT e.id, e.description, e.amount, e.category, e.expense_date
     FROM expenses e WHERE 1=1${filter.clause}
     ORDER BY e.expense_date DESC LIMIT 10`,
    params
  );
  return rows;
}

async function widgetBudgetStatus() {
  try {
    const { rows } = await query(
      `SELECT id, name, allocated_amount, spent_amount, period_start, period_end
       FROM budgets WHERE is_active = true ORDER BY period_start DESC LIMIT 6`
    );
    return rows;
  } catch { return []; }
}

async function widgetPaymentSummary({ userId, dataScope, departmentId }) {
  const filter = buildDataScopeFilter({ dataScope, userId, departmentId, tableAlias: 'p', paramOffset: 0 });
  const params = [...filter.params];
  const { rows } = await query(
    `SELECT COUNT(*) as total_count, COALESCE(SUM(amount),0) as total_amount,
            COUNT(*) FILTER (WHERE status='completed') as completed_count
     FROM payments p WHERE 1=1${filter.clause}`,
    params
  );
  return rows[0] || { total_count: 0, total_amount: 0, completed_count: 0 };
}

async function widgetSystemsOverview({ userId, dataScope, departmentId }) {
  const filter = buildDataScopeFilter({ dataScope, userId, departmentId, tableAlias: 's', paramOffset: 0 });
  const params = [...filter.params];
  const { rows } = await query(
    `SELECT s.id, s.name, s.status, s.version, s.created_at
     FROM systems s WHERE 1=1${filter.clause}
     ORDER BY s.created_at DESC LIMIT 6`,
    params
  );
  return rows;
}

async function widgetOperationsStats({ userId, dataScope, departmentId }) {
  const filter = buildDataScopeFilter({ dataScope, userId, departmentId, tableAlias: 'o', paramOffset: 0 });
  const params = [...filter.params];
  const { rows } = await query(
    `SELECT COUNT(*) as total_ops, COALESCE(SUM(amount),0) as total_spent,
            COALESCE(SUM(amount) FILTER (WHERE operation_date >= date_trunc('month', NOW())),0) as month_spent,
            COUNT(*) FILTER (WHERE operation_date >= date_trunc('month', NOW())) as month_ops
     FROM operations o WHERE 1=1${filter.clause}`,
    params
  );
  return rows[0] || { total_ops: 0, total_spent: 0, month_spent: 0, month_ops: 0 };
}

async function widgetAttentionItems({ userId, dataScope }) {
  // Only GLOBAL/DEPARTMENT scope gets org-wide attention items
  if (dataScope === 'OWN') return [];
  try {
    const { rows } = await query(`
      SELECT * FROM (
        SELECT 'overdue_followup' as item_type, f.id::text as item_id,
          p.company_name as label, f.scheduled_at::text as detail
        FROM followups f JOIN prospects p ON f.prospect_id = p.id
        WHERE f.status = 'scheduled' AND f.scheduled_at < NOW()
        ORDER BY f.scheduled_at ASC LIMIT 5
      ) ff
      UNION ALL
      SELECT * FROM (
        SELECT 'overdue_deal' as item_type, d.id::text as item_id,
          d.title as label, d.due_date::text as detail
        FROM deals d WHERE d.due_date IS NOT NULL AND d.due_date < NOW()
          AND d.status NOT IN ('completed','cancelled')
        ORDER BY d.due_date ASC LIMIT 5
      ) dd
    `);
    return rows;
  } catch { return []; }
}

async function widgetRecentActivity({ userId, dataScope }) {
  try {
    const params = [];
    let scopeFilter = '';
    if (dataScope === 'OWN') {
      params.push(userId);
      scopeFilter = ` AND user_id = $${params.length}`;
    }
    const { rows } = await query(
      `SELECT action, entity_type, details, created_at
       FROM audit_logs WHERE 1=1${scopeFilter}
       ORDER BY created_at DESC LIMIT 10`,
      params
    );
    return rows;
  } catch { return []; }
}

async function widgetMonthlyFinancials() {
  try {
    const { rows } = await query(`SELECT * FROM v_monthly_financials LIMIT 12`);
    return rows;
  } catch { return []; }
}

async function widgetAdminStats() {
  try {
    const [usersR, staffR, clientsR, rolesR] = await Promise.all([
      query(`SELECT COUNT(*) as count FROM users WHERE is_active = true`),
      query(`SELECT COUNT(*) as count FROM staff WHERE status = 'active'`),
      query(`SELECT COUNT(*) as count FROM clients WHERE status = 'active'`),
      query(`SELECT COUNT(*) as count FROM roles`),
    ]);
    return {
      total_users:   parseInt(usersR.rows[0]?.count   || 0),
      total_staff:   parseInt(staffR.rows[0]?.count   || 0),
      total_clients: parseInt(clientsR.rows[0]?.count || 0),
      total_roles:   parseInt(rolesR.rows[0]?.count   || 0),
    };
  } catch { return { total_users: 0, total_staff: 0, total_clients: 0, total_roles: 0 }; }
}

// ─── Widget registry ─────────────────────────────────────────────────────────

const WIDGET_FETCHERS = {
  pipeline_summary:   widgetPipelineSummary,
  recent_deals:       widgetRecentDeals,
  deal_summary:       widgetDealSummary,
  upcoming_followups: widgetUpcomingFollowups,
  my_prospects:       widgetMyProspects,
  financial_summary:  widgetFinancialSummary,
  account_balances:   widgetAccountBalances,
  recent_expenses:    widgetRecentExpenses,
  budget_status:      widgetBudgetStatus,
  payment_summary:    widgetPaymentSummary,
  systems_overview:   widgetSystemsOverview,
  operations:         widgetOperationsStats,
  attention_items:    widgetAttentionItems,
  recent_activity:    widgetRecentActivity,
  monthly_financials: widgetMonthlyFinancials,
  admin_overview:     widgetAdminStats,
};

// ─── Default widget layout per permission set ────────────────────────────────

function inferWidgetsFromPermissions(permissions) {
  const has = (p) => permissions.includes(p) || permissions.includes('*');
  const widgets = [];

  if (has('dashboard.view'))        widgets.push({ id: 'attention_items',   label: 'Attention Items',   size: 'medium' });
  if (has('pipeline.view'))         widgets.push({ id: 'pipeline_summary',  label: 'Pipeline',          size: 'medium' });
  if (has('deals.view'))            widgets.push({ id: 'deal_summary',      label: 'Deals',             size: 'medium' });
  if (has('prospects.view'))        widgets.push({ id: 'upcoming_followups',label: 'Follow-ups',        size: 'small' });
  if (has('prospects.view'))        widgets.push({ id: 'my_prospects',      label: 'My Prospects',      size: 'small' });
  if (has('finance.view'))          widgets.push({ id: 'financial_summary', label: 'Financial Overview',size: 'large' });
  if (has('accounts.view'))         widgets.push({ id: 'account_balances',  label: 'Accounts',          size: 'medium' });
  if (has('expenses.view'))         widgets.push({ id: 'recent_expenses',   label: 'Expenses',          size: 'medium' });
  if (has('budgets.view'))          widgets.push({ id: 'budget_status',     label: 'Budgets',           size: 'medium' });
  if (has('payments.view'))         widgets.push({ id: 'payment_summary',   label: 'Payments',          size: 'small' });
  if (has('systems.view'))          widgets.push({ id: 'systems_overview',  label: 'Systems',           size: 'large' });
  if (has('operations.view'))       widgets.push({ id: 'operations',        label: 'Operations',        size: 'small' });
  if (has('finance.view'))          widgets.push({ id: 'monthly_financials',label: 'Monthly P&L',       size: 'large' });
  if (has('activity_logs.view'))    widgets.push({ id: 'recent_activity',   label: 'Activity',          size: 'small' });
  if (has('users.view'))            widgets.push({ id: 'admin_overview',    label: 'Admin Overview',    size: 'medium' });

  // Always show deals if nothing else
  if (widgets.length === 0) {
    widgets.push({ id: 'recent_deals', label: 'Recent Deals', size: 'medium' });
  }
  return widgets;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

// GET /api/dashboard - Role-contextual dashboard data
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'dashboard.view');
    if (perm instanceof NextResponse) return perm;
    const { auth, dataScope, departmentId } = perm;
    const { userId } = auth;

    // 1. Load user's permissions (for widget selection)
    const userPermissions = auth.is_superadmin
      ? ['*']
      : (await import('@/lib/permissions.js').then(m => m.getUserPermissions(userId)).catch(() => []));

    // 2. Determine widget list: from dashboard_configs, otherwise auto-infer
    let widgetDefs = [];
    try {
      const configResult = await query(
        `SELECT dc.widgets
         FROM dashboard_configs dc
         JOIN roles r ON dc.role_id = r.id
         JOIN users u ON u.role = r.name OR EXISTS (
           SELECT 1 FROM staff s JOIN staff_roles sr ON sr.staff_id = s.id
           WHERE u.staff_id = s.id AND sr.role_id = r.id
         )
         WHERE u.id = $1
         ORDER BY r.authority_level DESC LIMIT 1`,
        [userId]
      );
      if (configResult.rows[0]?.widgets) {
        widgetDefs = configResult.rows[0].widgets;
      }
    } catch { /* table may not exist yet */ }

    if (widgetDefs.length === 0) {
      widgetDefs = inferWidgetsFromPermissions(userPermissions);
    }

    // 3. Filter widgets the user actually has permission for
    const allowableWidgets = widgetDefs.filter(w => {
      if (!w.permission) return true;
      if (auth.is_superadmin) return true;
      return userPermissions.includes(w.permission) || userPermissions.includes('*');
    });

    // 4. Fetch data for each widget in parallel
    const scopeCtx = { userId, dataScope: dataScope ?? 'GLOBAL', departmentId };
    const widgetDataEntries = await Promise.allSettled(
      allowableWidgets.map(async (w) => {
        const fetcher = WIDGET_FETCHERS[w.id];
        const data = fetcher ? await fetcher(scopeCtx) : null;
        return [w.id, data];
      })
    );

    const widgetData = {};
    widgetDataEntries.forEach((result, i) => {
      const widgetId = allowableWidgets[i]?.id;
      if (result.status === 'fulfilled' && widgetId) {
        const [id, data] = result.value;
        widgetData[id] = data;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        widgets: allowableWidgets,
        widgetData,
        userContext: {
          dataScope: dataScope ?? 'GLOBAL',
          role: auth.role,
        },
      },
    });
  } catch (error) {
    console.error('[Dashboard API] Error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to load dashboard' }, { status: 500 });
  }
}
