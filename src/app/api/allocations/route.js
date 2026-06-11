import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

const VALID_CATEGORIES = [
  'data', 'software_tools', 'hosting', 'food', 'transport',
  'operations', 'savings', 'rent', 'hardware', 'marketing',
  'salaries', 'taxes', 'other',
];

// GET /api/allocations  (?payment_id=X)
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'finance.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const payment_id = searchParams.get('payment_id');

    let sql = `
      SELECT a.*,
        p.amount as payment_amount,
        p.currency as payment_currency,
        d.title as deal_title,
        COALESCE(c.company_name, d.client_name, 'Unknown') as client_label
      FROM allocations a
      LEFT JOIN payments p ON a.payment_id = p.id
      LEFT JOIN deals d ON p.deal_id = d.id
      LEFT JOIN clients c ON d.client_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (payment_id) { params.push(payment_id); sql += ` AND a.payment_id = $${params.length}`; }
    sql += ` ORDER BY a.created_at DESC LIMIT 100`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Allocations] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch allocations' }, { status: 500 });
  }
}

// POST /api/allocations
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'finance.create');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { payment_id, category, amount, currency, notes } = body;

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ success: false, error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
    }
    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ success: false, error: 'amount must be > 0' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO allocations (payment_id, category, amount, currency, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [payment_id || null, category, parseFloat(amount), currency || 'UGX', notes || null]
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Allocations] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create allocation' }, { status: 500 });
  }
}
