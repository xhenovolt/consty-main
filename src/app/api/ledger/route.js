import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/ledger — finance.view
export async function GET(request) {
  const perm = await requirePermission(request, 'finance.view');
  if (perm instanceof NextResponse) return perm;
  try {
    const { searchParams } = new URL(request.url);
    const account_id = searchParams.get('account_id');
    const source_type = searchParams.get('source_type');
    const category = searchParams.get('category');
    const from_date = searchParams.get('from_date');
    const to_date = searchParams.get('to_date');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    let sql = `SELECT l.*, a.name as account_name, a.type as account_type FROM ledger l JOIN accounts a ON l.account_id = a.id WHERE 1=1`;
    const params = [];
    if (account_id) { params.push(account_id); sql += ` AND l.account_id = $${params.length}`; }
    if (source_type) { params.push(source_type); sql += ` AND l.source_type = $${params.length}`; }
    if (category) { params.push(category); sql += ` AND l.category = $${params.length}`; }
    if (from_date) { params.push(from_date); sql += ` AND l.entry_date >= $${params.length}`; }
    if (to_date) { params.push(to_date); sql += ` AND l.entry_date <= $${params.length}`; }
    const countResult = await query(`SELECT COUNT(*) FROM ledger l WHERE 1=1${account_id ? ` AND l.account_id = '${account_id}'` : ''}`);
    sql += ` ORDER BY l.entry_date DESC, l.created_at DESC`;
    params.push(limit); sql += ` LIMIT $${params.length}`;
    params.push(offset); sql += ` OFFSET $${params.length}`;
    const result = await query(sql, params);
    // Also include summary
    const summary = await query(`SELECT * FROM v_financial_summary`);
    return NextResponse.json({
      success: true,
      data: result.rows,
      summary: summary.rows[0],
      pagination: { total: parseInt(countResult.rows[0].count), limit, offset },
    });
  } catch (error) {
    console.error('[Ledger] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch ledger' }, { status: 500 });
  }
}

// POST /api/ledger — finance.create (admin only)
export async function POST(request) {
  // finance.ledger_entry gates the elevated "manual ledger entry" action.
  // Falls back to finance.create for backwards compatibility — any role
  // granted either works (and superadmins bypass via requirePermission).
  const perm = await requirePermission(request, 'finance.ledger_entry');
  const finalPerm = perm instanceof NextResponse
    ? await requirePermission(request, 'finance.create')
    : perm;
  if (finalPerm instanceof NextResponse) return finalPerm;
  const { auth } = finalPerm;
  try {

    const body = await request.json();
    const { account_id, amount, currency, description, category, entry_date } = body;
    if (!account_id || !amount || !description) {
      return NextResponse.json({ success: false, error: 'account_id, amount, and description are required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO ledger (account_id, amount, currency, source_type, description, category, entry_date, created_by)
       VALUES ($1,$2,$3,'adjustment',$4,$5,$6,$7) RETURNING *`,
      [account_id, amount, currency||'UGX', description, category||'adjustment', entry_date||new Date().toISOString().split('T')[0], auth.userId]
    );

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'ledger_adjustment', result.rows[0].id, JSON.stringify({ amount, description })]);

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Ledger] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create ledger entry' }, { status: 500 });
  }
}
