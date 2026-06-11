import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'finance.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const budget = await query(`SELECT * FROM v_budget_utilization WHERE budget_id = $1`, [id]);
    if (!budget.rows[0]) return NextResponse.json({ success: false, error: 'Budget not found' }, { status: 404 });
    const expenses = await query(
      `SELECT e.*, a.name as account_name FROM expenses e JOIN accounts a ON e.account_id = a.id WHERE e.budget_id = $1 ORDER BY e.expense_date DESC`, [id]
    );
    return NextResponse.json({ success: true, data: { ...budget.rows[0], expenses: expenses.rows } });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch budget' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'finance.create');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const body = await request.json();
    const fields = ['name','category','amount','currency','period','start_date','end_date','alert_threshold','is_active','notes'];
    const updates = [];
    const values = [];
    fields.forEach(f => { if (body[f] !== undefined) { values.push(body[f]); updates.push(`${f} = $${values.length}`); } });
    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    values.push(id);
    const result = await query(`UPDATE budgets SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Budget not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update budget' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'finance.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    // Unlink expenses from this budget first
    await query(`UPDATE expenses SET budget_id = NULL WHERE budget_id = $1`, [id]);
    const result = await query(`DELETE FROM budgets WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Budget not found' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Budget deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete budget' }, { status: 500 });
  }
}
