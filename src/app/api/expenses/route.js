import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission, buildDataScopeFilter } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';

// GET /api/expenses (data-scope enforced)
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'expenses', 'view');
    if (perm instanceof NextResponse) return perm;
    const { auth, dataScope, departmentId } = perm;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const from_date = searchParams.get('from_date');
    const to_date = searchParams.get('to_date');

    const params = [];
    let sql = `SELECT e.*, a.name as account_name FROM expenses e JOIN accounts a ON e.account_id = a.id WHERE 1=1`;

    if (category) { params.push(category); sql += ` AND e.category = $${params.length}`; }
    if (from_date) { params.push(from_date); sql += ` AND e.expense_date >= $${params.length}`; }
    if (to_date) { params.push(to_date); sql += ` AND e.expense_date <= $${params.length}`; }

    // ── Data scope enforcement ───────────────────────────────────────────────
    const scopeFilter = buildDataScopeFilter({
      dataScope: dataScope ?? 'GLOBAL',
      userId: auth.userId,
      departmentId,
      tableAlias: 'e',
      paramOffset: params.length,
    });
    sql += scopeFilter.clause;
    params.push(...scopeFilter.params);

    sql += ` ORDER BY e.expense_date DESC`;
    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Expenses] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

// POST /api/expenses - Create expense WITH automatic ledger entry
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { account_id, amount, currency, category, subcategory, vendor, description, expense_date, receipt_url, is_recurring, recurrence_interval, budget_id, tags, notes } = body;
    
    if (!account_id || !amount || !category || !description) {
      return NextResponse.json({ success: false, error: 'account_id, amount, category, and description are required' }, { status: 400 });
    }

    const expResult = await query(
      `INSERT INTO expenses (account_id, amount, currency, category, subcategory, vendor, description, expense_date, receipt_url, is_recurring, recurrence_interval, status, budget_id, tags, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'recorded',$12,$13,$14,$15) RETURNING *`,
      [account_id, amount, currency||'UGX', category, subcategory||null, vendor||null, description,
       expense_date||new Date().toISOString().split('T')[0], receipt_url||null,
       is_recurring||false, recurrence_interval||null, budget_id||null, tags||'{}', notes||null, auth.userId]
    );

    const expense = expResult.rows[0];

    // Create ledger entry (DEBIT from account - negative amount)
    const ledgerResult = await query(
      `INSERT INTO ledger (account_id, amount, currency, source_type, source_id, description, category, entry_date, created_by)
       VALUES ($1,$2,$3,'expense',$4,$5,$6,$7,$8) RETURNING id`,
      [account_id, -Math.abs(amount), currency||'UGX', expense.id,
       `${category}: ${description}${vendor ? ' (' + vendor + ')' : ''}`,
       category, expense_date||new Date().toISOString().split('T')[0], auth.userId]
    );

    await query(`UPDATE expenses SET ledger_entry_id = $1 WHERE id = $2`, [ledgerResult.rows[0].id, expense.id]);
    expense.ledger_entry_id = ledgerResult.rows[0].id;

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'expense', expense.id, JSON.stringify({ category, amount, vendor })]);

    dispatch('expense_recorded', { entityType: 'expense', entityId: expense.id, description: `Expense recorded: ${currency || 'UGX'} ${Number(amount).toLocaleString()} — ${description}`, metadata: { amount, currency: currency || 'UGX', category, description, vendor }, actorId: auth.userId }).catch(() => {});

    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (error) {
    console.error('[Expenses] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create expense' }, { status: 500 });
  }
}
