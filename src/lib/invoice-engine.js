/**
 * Invoice Generation Engine
 * Automatically creates invoices when payments are recorded.
 * Generates invoice numbers in CST-INV-YYYY-XXXX format.
 */

import { query } from '@/lib/db.js';
import { dispatch } from '@/lib/system-events.js';

/**
 * Generate next invoice number: CST-INV-YYYY-XXXX
 */
export async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  
  const result = await query(
    `INSERT INTO invoice_sequences (year, last_number) VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE SET last_number = invoice_sequences.last_number + 1
     RETURNING last_number`,
    [year]
  );
  
  const num = result.rows[0].last_number;
  return `CST-INV-${year}-${String(num).padStart(4, '0')}`;
}

/**
 * Create an invoice record for a payment.
 * Called automatically after payment creation.
 * 
 * @param {Object} params
 * @param {Object} params.payment - The payment record
 * @param {Object} params.deal - The deal record
 * @param {string} params.userId - The user who recorded the payment
 * @returns {Object} The created invoice record
 */
export async function createInvoiceForPayment({ payment, deal, userId }) {
  try {
    const invoiceNumber = await generateInvoiceNumber();
    
    // Calculate running totals
    const totalsResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total_paid 
       FROM payments WHERE deal_id = $1 AND status = 'completed' AND id != $2`,
      [deal.id, payment.id]
    );
    const paidBefore = parseFloat(totalsResult.rows[0].total_paid);
    const paidAfter = paidBefore + parseFloat(payment.amount);
    const dealTotal = parseFloat(deal.total_amount || 0);
    const remaining = Math.max(0, dealTotal - paidAfter);

    // Get client info
    let clientName = deal.company_name || deal.client_name || 'Unknown Client';
    let clientEmail = '';
    let clientPhone = '';
    let clientAddress = '';
    let clientId = deal.client_id || null;

    if (clientId) {
      try {
        const clientResult = await query(
          `SELECT company_name, email, phone, address FROM clients WHERE id = $1`, [clientId]
        );
        if (clientResult.rows[0]) {
          const c = clientResult.rows[0];
          clientName = c.company_name || clientName;
          clientEmail = c.email || '';
          clientPhone = c.phone || '';
          clientAddress = c.address || '';
        }
      } catch {}
    }

    // Get user info for issued_by
    let issuedByName = 'Authorized Officer';
    if (userId) {
      try {
        const u = await query(`SELECT name, full_name FROM users WHERE id = $1`, [userId]);
        if (u.rows[0]) issuedByName = u.rows[0].full_name || u.rows[0].name || issuedByName;
      } catch {}
    }

    const invoice = await query(
      `INSERT INTO invoices (
        invoice_number, deal_id, payment_id, client_id, client_name, client_email, client_phone, client_address,
        system_id, system_name, plan_name, deal_title, deal_total_amount,
        amount, currency, total_paid_before, total_paid_after, remaining_balance,
        payment_method, payment_reference,
        issued_by_user_id, issued_by_name, issued_date, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      RETURNING *`,
      [
        invoiceNumber, deal.id, payment.id, clientId, clientName, clientEmail, clientPhone, clientAddress,
        deal.system_id || null, deal.system_name || null, deal.plan_name || deal.offering_name || null,
        deal.title, dealTotal,
        payment.amount, payment.currency || 'UGX', paidBefore, paidAfter, remaining,
        payment.method || null, payment.reference || null,
        userId, issuedByName, payment.payment_date || new Date().toISOString().split('T')[0], 'paid'
      ]
    );

    const inv = invoice.rows[0];

    // Fire event for notification
    dispatch('invoice_created', {
      entityType: 'invoice',
      entityId: inv.id,
      description: `Invoice ${invoiceNumber} generated for ${inv.currency} ${Number(inv.amount).toLocaleString()} — ${clientName}`,
      metadata: {
        invoice_number: invoiceNumber,
        amount: inv.amount,
        currency: inv.currency,
        client_name: clientName,
        deal_title: deal.title,
      },
      actorId: userId,
    }).catch(() => {});

    return inv;
  } catch (err) {
    console.error('[InvoiceEngine] Failed to create invoice:', err.message);
    return null;
  }
}
