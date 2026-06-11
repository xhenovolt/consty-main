import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * GET /api/payments/convert
 * Convert amount to UGX
 */
export async function GET(req) {
  const perm = await requirePermission(req, 'payments.view');
  if (perm instanceof NextResponse) return perm;
  try {
    const { searchParams } = new URL(req.url);
    const amount = parseFloat(searchParams.get('amount'));
    const currency = searchParams.get('currency') || 'UGX';
    const exchangeRate = searchParams.get('exchange_rate');
    
    if (isNaN(amount)) {
      return NextResponse.json(
        { success: false, error: 'Invalid amount' },
        { status: 400 }
      );
    }
    
    // Get conversion rate
    let rate = exchangeRate ? parseFloat(exchangeRate) : null;
    
    if (!rate && currency !== 'UGX') {
      // Try to fetch from exchange_rates table first
      try {
        const rateResult = await query(
          `SELECT rate FROM exchange_rates WHERE from_currency = $1 AND to_currency = 'UGX' AND is_current = true ORDER BY effective_date DESC LIMIT 1`,
          [currency]
        );
        if (rateResult.rows.length > 0) {
          rate = parseFloat(rateResult.rows[0].rate);
        }
      } catch {}
      
      // Fallback to hardcoded rates
      if (!rate) {
        const rates = { USD: 3800, EUR: 4200, GBP: 4800, ZAR: 200, KES: 36 };
        rate = rates[currency] || 1;
      }
    }
    
    const amountUgx = currency === 'UGX' ? amount : amount * (rate || 1);
    
    return NextResponse.json({
      success: true,
      original_amount: amount,
      currency,
      exchange_rate: rate,
      amount_ugx: amountUgx,
    });
  } catch (error) {
    console.error('Error converting currency:', error);
    return NextResponse.json(
      { success: false, error: 'Conversion failed' },
      { status: 500 }
    );
  }
}

