import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/budgets
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'budgets', 'view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const result = await query(`SELECT * FROM v_budget_utilization ORDER BY start_date DESC`);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

// POST /api/budgets
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const body = await request.json();
    const { name, category, amount, currency, period, start_date, end_date, alert_threshold, notes } = body;
    if (!name || !category || !amount || !period || !start_date || !end_date) {
      return NextResponse.json({ success: false, error: 'name, category, amount, period, start_date, and end_date are required' }, { status: 400 });
    }
    const result = await query(
      `INSERT INTO budgets (name, category, amount, currency, period, start_date, end_date, alert_threshold, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, category, amount, currency||'UGX', period, start_date, end_date, alert_threshold||80, notes||null, auth.userId]
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create budget' }, { status: 500 });
  }
}
