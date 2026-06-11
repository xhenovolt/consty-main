import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/exchange-rates — Get current exchange rates
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const from_currency = searchParams.get('from');
    const to_currency = searchParams.get('to');

    let sql = `SELECT * FROM exchange_rates WHERE is_current = true`;
    const params = [];

    if (from_currency) {
      params.push(from_currency.toUpperCase());
      sql += ` AND from_currency = $${params.length}`;
    }
    if (to_currency) {
      params.push(to_currency.toUpperCase());
      sql += ` AND to_currency = $${params.length}`;
    }

    sql += ` ORDER BY from_currency, to_currency`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Exchange Rates] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch exchange rates' }, { status: 500 });
  }
}

// POST /api/exchange-rates — Create or update exchange rate
export async function POST(request) {
  const perm = await requirePermission(request, 'finance.edit');
  if (perm instanceof NextResponse) return perm;

  try {
    const body = await request.json();
    const { from_currency, to_currency, rate, source, notes } = body;

    if (!from_currency || !to_currency || !rate) {
      return NextResponse.json({
        success: false,
        error: 'from_currency, to_currency, and rate are required'
      }, { status: 400 });
    }

    if (parseFloat(rate) <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Exchange rate must be positive'
      }, { status: 400 });
    }

    // Mark all previous rates as not current
    await query(
      `UPDATE exchange_rates SET is_current = false 
       WHERE from_currency = $1 AND to_currency = $2 AND is_current = true`,
      [from_currency.toUpperCase(), to_currency.toUpperCase()]
    );

    const result = await query(
      `INSERT INTO exchange_rates (from_currency, to_currency, rate, source, notes, is_current, effective_date)
       VALUES ($1, $2, $3, $4, $5, true, CURRENT_DATE)
       RETURNING *`,
      [
        from_currency.toUpperCase(),
        to_currency.toUpperCase(),
        parseFloat(rate),
        source || 'manual',
        notes || null
      ]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Exchange Rates] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create exchange rate' }, { status: 500 });
  }
}
