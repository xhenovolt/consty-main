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
    const result = await query(`SELECT e.*, a.name as account_name FROM expenses e JOIN accounts a ON e.account_id = a.id WHERE e.id = $1`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Expense not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch expense' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'finance.create');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const body = await request.json();
    const fields = ['category','subcategory','vendor','description','expense_date','receipt_url','is_recurring','recurrence_interval','status','budget_id','tags','notes'];
    const updates = [];
    const values = [];
    fields.forEach(f => { if (body[f] !== undefined) { values.push(body[f]); updates.push(`${f} = $${values.length}`); } });
    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    values.push(id);
    const result = await query(`UPDATE expenses SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Expense not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'finance.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    // Void the expense instead of deleting; create a reverse ledger entry
    const expense = await query(`SELECT * FROM expenses WHERE id = $1`, [id]);
    if (!expense.rows[0]) return NextResponse.json({ success: false, error: 'Expense not found' }, { status: 404 });
    
    await query(`UPDATE expenses SET status = 'void' WHERE id = $1`, [id]);
    
    // Create reverse ledger entry
    if (expense.rows[0].ledger_entry_id) {
      await query(
        `INSERT INTO ledger (account_id, amount, currency, source_type, source_id, description, category, entry_date, created_by)
         VALUES ($1,$2,$3,'adjustment',$4,$5,$6,CURRENT_DATE,$7)`,
        [expense.rows[0].account_id, Math.abs(expense.rows[0].amount), expense.rows[0].currency,
         id, `VOID: ${expense.rows[0].description}`, expense.rows[0].category, auth.userId]
      );
    }

    return NextResponse.json({ success: true, message: 'Expense voided' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to void expense' }, { status: 500 });
  }
}
