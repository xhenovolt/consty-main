import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission, buildDataScopeFilter } from '@/lib/permissions.js';
import { Events } from '@/lib/events.js';
import { dispatch } from '@/lib/system-events.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUUID(v) { return typeof v === 'string' && UUID_RE.test(v); }

// GET /api/deals — deals.view (data-scope enforced)
export async function GET(request) {
  const perm = await requirePermission(request, 'deals.view');
  if (perm instanceof NextResponse) return perm;
  try {
    const { auth, dataScope, departmentId } = perm;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const client_id = searchParams.get('client_id');
    const system_id = searchParams.get('system_id');

    const params = [];
    let sql = `SELECT d.*,
      COALESCE(c.company_name, d.client_name, 'Unknown') as client_label,
      o.name as offering_name,
      s.name as system_name,
      svc.name as service_name,
      COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.deal_id = d.id AND p.status = 'completed'), 0) as paid_amount,
      d.total_amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.deal_id = d.id AND p.status = 'completed'), 0) as remaining_amount,
      (SELECT COUNT(*) FROM payments p WHERE p.deal_id = d.id AND p.status = 'completed') as payment_count
      FROM deals d
      LEFT JOIN clients c ON d.client_id = c.id
      LEFT JOIN offerings o ON d.offering_id = o.id
      LEFT JOIN systems s ON d.system_id = s.id
      LEFT JOIN services svc ON d.service_id = svc.id
      WHERE 1=1`;

    if (status) { params.push(status); sql += ` AND d.status = $${params.length}`; }
    if (client_id) { params.push(client_id); sql += ` AND d.client_id = $${params.length}`; }
    if (system_id) { params.push(system_id); sql += ` AND d.system_id = $${params.length}`; }

    // ── Data scope enforcement ───────────────────────────────────────────────
    const scopeFilter = buildDataScopeFilter({
      dataScope: dataScope ?? 'GLOBAL',
      userId: auth.userId,
      departmentId,
      tableAlias: 'd',
      paramOffset: params.length,
    });
    sql += scopeFilter.clause;
    params.push(...scopeFilter.params);

    sql += ` ORDER BY d.created_at DESC`;
    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Deals] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch deals' }, { status: 500 });
  }
}

// POST /api/deals — deals.create
export async function POST(request) {
  const perm = await requirePermission(request, 'deals.create');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  try {
    const body = await request.json();
    const {
      client_id, prospect_id, offering_id, system_id, service_id, plan_id,
      client_name, title, description, total_amount,
      original_price, negotiated_price, installation_fee,
      currency, status, start_date, end_date, due_date,
      invoice_number, terms, notes, tags,
      initial_payment, // optional: { amount, account_id, method, payment_date, notes }
    } = body;

    if (!title || !total_amount) {
      return NextResponse.json({ success: false, error: 'title and total_amount are required' }, { status: 400 });
    }
    if (!client_id && !client_name) {
      return NextResponse.json({ success: false, error: 'client_id or client_name is required' }, { status: 400 });
    }

    // Determine initial status based on whether there's an initial payment
    let dealStatus = status || 'draft';

    const result = await query(
      `INSERT INTO deals (
        client_id, prospect_id, offering_id, system_id, service_id, plan_id,
        client_name, title, description, total_amount,
        original_price, negotiated_price, installation_fee,
        currency, status, start_date, end_date, due_date,
        invoice_number, terms, notes, tags, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
      [
        client_id || null, prospect_id || null, offering_id || null,
        system_id || null, service_id || null, plan_id || null,
        client_name || null, title, description || null,
        total_amount,
        original_price || null, negotiated_price || null, installation_fee || null,
        currency || 'UGX', dealStatus,
        start_date || null, end_date || null, due_date || null,
        invoice_number || null, terms || null, notes || null,
        tags || '{}', auth.userId,
      ]
    );

    const deal = result.rows[0];

    // Record initial payment if provided
    if (initial_payment && initial_payment.amount > 0 && initial_payment.account_id && isUUID(initial_payment.account_id)) {
      try {
        const payResult = await query(
          `INSERT INTO payments (deal_id, account_id, amount, currency, method, status, payment_date, notes, received_at, created_by)
           VALUES ($1,$2,$3,$4,$5,'completed',$6,$7,NOW(),$8) RETURNING *`,
          [
            deal.id, initial_payment.account_id, initial_payment.amount,
            currency || 'UGX', initial_payment.method || 'cash',
            initial_payment.payment_date || new Date().toISOString().split('T')[0],
            initial_payment.notes || null, auth.userId,
          ]
        );
        const payment = payResult.rows[0];

        // Create ledger entry for the payment
        const clientLabel = client_name || 'Client';
        let clientLabelResolved = clientLabel;
        if (client_id) {
          try {
            const cl = await query(`SELECT company_name FROM clients WHERE id = $1`, [client_id]);
            if (cl.rows[0]) clientLabelResolved = cl.rows[0].company_name;
          } catch {}
        }
        const ledgerResult = await query(
          `INSERT INTO ledger (account_id, amount, currency, source_type, source_id, description, category, entry_date, created_by)
           VALUES ($1,$2,$3,'payment',$4,$5,'revenue',$6,$7) RETURNING id`,
          [
            initial_payment.account_id, initial_payment.amount, currency || 'UGX',
            payment.id, `Payment from ${clientLabelResolved} — ${title}`,
            initial_payment.payment_date || new Date().toISOString().split('T')[0], auth.userId,
          ]
        );
        await query(`UPDATE payments SET ledger_entry_id = $1 WHERE id = $2`, [ledgerResult.rows[0].id, payment.id]);

        // Log the payment event
        try { await Events.paymentReceived(payment.id, initial_payment.amount, currency || 'UGX', title, auth.userId); } catch {}

        // Update deal status based on payment
        const paidAmount = initial_payment.amount;
        const totalDealAmount = parseFloat(total_amount);
        let newStatus = 'draft';
        if (paidAmount >= totalDealAmount) {
          newStatus = 'completed';
        } else if (paidAmount > 0) {
          newStatus = 'in_progress';
        }
        if (newStatus !== dealStatus) {
          await query(`UPDATE deals SET status = $1 WHERE id = $2`, [newStatus, deal.id]);
          deal.status = newStatus;
        }
        deal.paid_amount = paidAmount;
        deal.remaining_amount = totalDealAmount - paidAmount;
      } catch (payErr) {
        console.error('[Deals] Initial payment error:', payErr);
        // Deal was created, payment failed — don't fail the whole thing
        deal.paid_amount = 0;
        deal.remaining_amount = parseFloat(total_amount);
      }
    } else {
      if (initial_payment && initial_payment.account_id && !isUUID(initial_payment.account_id)) {
        console.error('[Deals] Invalid account_id (not UUID):', initial_payment.account_id);
      }
      deal.paid_amount = 0;
      deal.remaining_amount = parseFloat(total_amount);
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'deal', deal.id, JSON.stringify({ title, total_amount, has_payment: !!initial_payment })]
    );
    try { await Events.dealCreated(deal.id, title, auth.userId); } catch {}

    dispatch('deal_created', { entityType: 'deal', entityId: deal.id, description: `Deal created: ${title}`, metadata: { title, total_amount, currency: currency || 'UGX', has_payment: !!initial_payment }, actorId: auth.userId }).catch(() => {});

    return NextResponse.json({ success: true, data: deal }, { status: 201 });
  } catch (error) {
    console.error('[Deals] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create deal: ' + error.message }, { status: 500 });
  }
}
