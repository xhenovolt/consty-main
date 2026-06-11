import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';
import { getCompanySettings } from '@/lib/company-settings.js';

/**
 * GET /api/invoices/[id]/pdf
 * Generates an HTML invoice that can be printed/saved as PDF.
 * Returns HTML content with print-optimized CSS.
 */
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'invoices.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const [result, co] = await Promise.all([
      query(`SELECT * FROM invoices WHERE id = $1`, [id]),
      getCompanySettings(),
    ]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });

    const inv = result.rows[0];
    const fmtAmount = (amount, currency = 'UGX') => {
      const n = parseFloat(amount || 0);
      return `${currency} ${n.toLocaleString()}`;
    };

    // Log download event
    dispatch('invoice_downloaded', {
      entityType: 'invoice',
      entityId: id,
      description: `Invoice ${inv.invoice_number} downloaded`,
      metadata: { invoice_number: inv.invoice_number },
      actorId: auth.userId,
    }).catch(() => {});

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${inv.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a2e; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #1a1a2e; }
    .company-info h1 { font-size: 28px; font-weight: 800; color: #1a1a2e; letter-spacing: -0.5px; }
    .company-info p { font-size: 12px; color: #666; margin-top: 4px; }
    .invoice-meta { text-align: right; }
    .invoice-meta .invoice-label { font-size: 32px; font-weight: 800; color: #3b82f6; letter-spacing: 2px; }
    .invoice-meta .invoice-number { font-size: 14px; font-weight: 600; color: #1a1a2e; margin-top: 4px; }
    .invoice-meta .date { font-size: 12px; color: #666; margin-top: 2px; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .party { flex: 1; }
    .party h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #999; margin-bottom: 8px; font-weight: 600; }
    .party p { font-size: 13px; line-height: 1.6; }
    .party .name { font-weight: 700; font-size: 15px; color: #1a1a2e; }
    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .details-table th { background: #1a1a2e; color: #fff; padding: 12px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; text-align: left; }
    .details-table th:last-child { text-align: right; }
    .details-table td { padding: 14px 16px; border-bottom: 1px solid #eee; font-size: 13px; }
    .details-table td:last-child { text-align: right; font-weight: 600; }
    .totals { margin-left: auto; width: 300px; }
    .totals .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; }
    .totals .row.total { font-size: 16px; font-weight: 800; border-top: 2px solid #1a1a2e; padding-top: 12px; margin-top: 4px; }
    .totals .row.paid { color: #059669; }
    .totals .row.balance { color: ${parseFloat(inv.remaining_balance) > 0 ? '#dc2626' : '#059669'}; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .status-paid { background: #dcfce7; color: #166534; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; }
    .footer .notes { font-size: 12px; color: #666; margin-bottom: 30px; }
    .signature { margin-top: 40px; }
    .signature .line { width: 200px; border-top: 1px solid #333; padding-top: 8px; }
    .signature .name { font-weight: 700; font-size: 13px; }
    .signature .title { font-size: 11px; color: #666; }
    .watermark { position: fixed; bottom: 20px; right: 40px; font-size: 10px; color: #ccc; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #3b82f6; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: 600; z-index: 100; }
    .print-btn:hover { background: #2563eb; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save PDF</button>

  <div class="header">
    <div class="company-info" style="display:flex;align-items:flex-start;gap:12px">
      ${co.company_logo ? `<img src="${co.company_logo}" alt="Logo" style="max-height:60px;max-width:140px;object-fit:contain;display:block;margin-top:2px">` : ''}
      <div>
        <h1>${co.company_name}</h1>
        ${co.company_address ? `<p>${co.company_address}</p>` : ''}
        <p>${[co.company_phone_1, co.company_phone_2, co.company_phone_3].filter(Boolean).join(' · ')}${co.company_email ? ' · ' + co.company_email : ''}</p>
        ${co.company_tagline ? `<p>${co.company_tagline}</p>` : ''}
        ${co.company_tin ? `<p>TIN: ${co.company_tin}</p>` : ''}
      </div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-label">INVOICE</div>
      <div class="invoice-number">${inv.invoice_number}</div>
      <div class="date">Issued: ${new Date(inv.issued_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div style="margin-top: 8px;"><span class="status-badge status-${inv.status}">${inv.status}</span></div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Billed To</h3>
      <p class="name">${inv.client_name}</p>
      ${inv.client_email ? `<p>${inv.client_email}</p>` : ''}
      ${inv.client_phone ? `<p>${inv.client_phone}</p>` : ''}
      ${inv.client_address ? `<p>${inv.client_address}</p>` : ''}
    </div>
    <div class="party" style="text-align: right;">
      <h3>Deal Reference</h3>
      <p class="name">${inv.deal_title || 'N/A'}</p>
      ${inv.system_name ? `<p>System: ${inv.system_name}</p>` : ''}
      ${inv.plan_name ? `<p>Plan: ${inv.plan_name}</p>` : ''}
      ${inv.payment_method ? `<p>Payment: ${inv.payment_method.replace(/_/g, ' ')}</p>` : ''}
      ${inv.payment_reference ? `<p>Ref: ${inv.payment_reference}</p>` : ''}
    </div>
  </div>

  <table class="details-table">
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          Payment for ${inv.deal_title || 'Deal'}
          ${inv.system_name ? `<br><small style="color: #666;">System: ${inv.system_name}</small>` : ''}
          ${inv.plan_name ? `<br><small style="color: #666;">Plan: ${inv.plan_name}</small>` : ''}
        </td>
        <td>${fmtAmount(inv.amount, inv.currency)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Deal Total Value</span><span>${fmtAmount(inv.deal_total_amount, inv.currency)}</span></div>
    <div class="row"><span>Previously Paid</span><span>${fmtAmount(inv.total_paid_before, inv.currency)}</span></div>
    <div class="row paid total"><span>This Payment</span><span>${fmtAmount(inv.amount, inv.currency)}</span></div>
    <div class="row balance"><span>Remaining Balance</span><span>${fmtAmount(inv.remaining_balance, inv.currency)}</span></div>
  </div>

  <div class="footer">
    ${inv.notes ? `<div class="notes"><strong>Notes:</strong> ${inv.notes}</div>` : ''}
    <div class="signature">
      <div class="line">
        <div class="name">${inv.issued_by_name || 'Authorized Signatory'}</div>
        <div class="title">Chief Executive Officer (CEO)</div>
      </div>
    </div>
  </div>

  <div class="watermark">Generated by Consty OS · ${inv.invoice_number}</div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${inv.invoice_number}.html"`,
      },
    });
  } catch (error) {
    console.error('[Invoices] PDF error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate invoice' }, { status: 500 });
  }
}
