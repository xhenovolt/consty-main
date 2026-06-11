import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission, buildDataScopeFilter } from '@/lib/permissions.js';
import { Events } from '@/lib/events.js';
import { dispatch } from '@/lib/system-events.js';
import { createInvoiceForPayment } from '@/lib/invoice-engine.js';

// GET /api/payments — payments.view (data-scope enforced)
export async function GET(request) {
  const perm = await requirePermission(request, 'payments.view');
  if (perm instanceof NextResponse) return perm;
  try {
    const { auth, dataScope, departmentId } = perm;
    const { searchParams } = new URL(request.url);
    const deal_id = searchParams.get('deal_id');
    const status = searchParams.get('status');

    const params = [];
    let sql = `SELECT p.*, d.title as deal_title, COALESCE(c.company_name, d.client_name) as client_name, a.name as account_name
               FROM payments p
               LEFT JOIN deals d ON p.deal_id = d.id
               LEFT JOIN clients c ON d.client_id = c.id
               LEFT JOIN accounts a ON p.account_id = a.id WHERE 1=1`;

    if (deal_id) { params.push(deal_id); sql += ` AND p.deal_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND p.status = $${params.length}`; }

    // ── Data scope enforcement ───────────────────────────────────────────────
    const scopeFilter = buildDataScopeFilter({
      dataScope: dataScope ?? 'GLOBAL',
      userId: auth.userId,
      departmentId,
      tableAlias: 'p',
      paramOffset: params.length,
    });
    sql += scopeFilter.clause;
    params.push(...scopeFilter.params);

    sql += ` ORDER BY p.payment_date DESC`;
    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Payments] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch payments' }, { status: 500 });
  }
}

// POST /api/payments — payments.create
export async function POST(request) {
  const perm = await requirePermission(request, 'payments.create');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  try {
    const body = await request.json();
    const { deal_id, account_id, amount, currency, method, reference, status, payment_date, notes, exchange_rate } = body;
    
    if (!deal_id || !account_id || !amount) {
      return NextResponse.json({ success: false, error: 'deal_id, account_id, and amount are required' }, { status: 400 });
    }

    if (!currency) {
      return NextResponse.json({ success: false, error: 'Currency is required' }, { status: 400 });
    }

    // Validate deal exists and check remaining amount
    const deal = await query(`SELECT d.*, COALESCE(c.company_name, d.client_name) as company_name FROM deals d LEFT JOIN clients c ON d.client_id = c.id WHERE d.id = $1`, [deal_id]);
    if (!deal.rows[0]) return NextResponse.json({ success: false, error: 'Deal not found' }, { status: 404 });

    const paymentStatus = status || 'completed';
    const paymentCurrency = (currency || 'UGX').toUpperCase();
    
    // ── MULTI-CURRENCY LOGIC ───────────────────────────────────────────────
    // Original amount = the amount in original currency
    // amount_ugx = amount converted to UGX
    
    let original_amount = parseFloat(amount);
    let original_currency = paymentCurrency;
    let amount_ugx = original_amount;
    let actual_exchange_rate = 1.0;
    
    // If not UGX, need to calculate UGX equivalent
    if (paymentCurrency !== 'UGX') {
      // If exchange_rate provided in request, use it
      if (exchange_rate) {
        actual_exchange_rate = parseFloat(exchange_rate);
      } else {
        // Fetch current exchange rate from database
        const rateResult = await query(
          `SELECT rate FROM exchange_rates 
           WHERE from_currency = $1 AND to_currency = 'UGX' 
           AND is_current = true 
           ORDER BY effective_date DESC LIMIT 1`,
          [paymentCurrency]
        );
        if (rateResult.rows.length > 0) {
          actual_exchange_rate = parseFloat(rateResult.rows[0].rate);
        } else {
          // Default fallback rate (1:1 if not found - app should warn user)
          actual_exchange_rate = 1.0;
        }
      }
      amount_ugx = original_amount * actual_exchange_rate;
    }

    // Create payment with all multi-currency fields
    const payResult = await query(
      `INSERT INTO payments 
       (deal_id, account_id, amount, currency, original_amount, original_currency, 
        exchange_rate, amount_ugx, method, reference, status, payment_date, notes, 
        received_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) 
       RETURNING *`,
      [
        deal_id, account_id, original_amount, paymentCurrency,
        original_amount, original_currency, actual_exchange_rate, amount_ugx,
        method || null, reference || null, paymentStatus,
        payment_date || new Date().toISOString().split('T')[0],
        notes || null,
        paymentStatus === 'completed' ? new Date() : null,
        auth.userId
      ]
    );

    const payment = payResult.rows[0];

    // If completed, create ledger entry (CREDIT to account)
    if (paymentStatus === 'completed') {
      const ledgerResult = await query(
        `INSERT INTO ledger 
         (account_id, amount, currency, original_amount, original_currency, exchange_rate,
          source_type, source_id, description, category, entry_date, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'payment',$7,$8,'revenue',$9,$10) 
         RETURNING id`,
        [
          account_id, amount_ugx, 'UGX', original_amount, original_currency, actual_exchange_rate,
          payment.id,
          `Payment from ${deal.rows[0].company_name} - ${deal.rows[0].title}`,
          payment_date || new Date().toISOString().split('T')[0],
          auth.userId
        ]
      );
      // Link ledger entry back to payment
      await query(`UPDATE payments SET ledger_entry_id = $1 WHERE id = $2`, [ledgerResult.rows[0].id, payment.id]);
      payment.ledger_entry_id = ledgerResult.rows[0].id;
    }

    // Auto-compute deal status based on total completed payments
    if (paymentStatus === 'completed') {
      const totals = await query(
        `SELECT COALESCE(SUM(p.amount),0) as paid FROM payments p WHERE p.deal_id = $1 AND p.status = 'completed'`, [deal_id]
      );
      const totalPaid = parseFloat(totals.rows[0].paid);
      const totalDeal = parseFloat(deal.rows[0].total_amount);
      let newDealStatus = deal.rows[0].status;
      if (totalPaid >= totalDeal) newDealStatus = 'completed';
      else if (totalPaid > 0) newDealStatus = 'in_progress';
      if (newDealStatus !== deal.rows[0].status) {
        await query(`UPDATE deals SET status = $1 WHERE id = $2`, [newDealStatus, deal_id]);
      }
    }

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'payment', payment.id, JSON.stringify({ deal_id, amount, method })]);
    await Events.paymentReceived(payment.id, amount, currency || 'UGX', deal.rows[0].title, auth.userId);

    dispatch('payment_received', { entityType: 'payment', entityId: payment.id, description: `Payment: ${currency || 'UGX'} ${Number(amount).toLocaleString()} for ${deal.rows[0].title}`, metadata: { amount, currency: currency || 'UGX', deal_title: deal.rows[0].title, deal_id }, actorId: auth.userId }).catch(() => {});

    // Auto-generate invoice for completed payments
    let invoice = null;
    if (paymentStatus === 'completed') {
      invoice = await createInvoiceForPayment({
        payment,
        deal: deal.rows[0],
        userId: auth.userId,
      });
    }

    return NextResponse.json({ success: true, data: { ...payment, invoice } }, { status: 201 });
  } catch (error) {
    console.error('[Payments] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create payment' }, { status: 500 });
  }
}
