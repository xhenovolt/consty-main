import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/invoices/[id] — Single invoice
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'invoices.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const result = await query(`SELECT * FROM invoices WHERE id = $1`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });

    // Log view event
    dispatch('invoice_viewed', {
      entityType: 'invoice',
      entityId: id,
      description: `Invoice ${result.rows[0].invoice_number} viewed`,
      metadata: { invoice_number: result.rows[0].invoice_number },
      actorId: auth.userId,
    }).catch(() => {});

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Invoices] GET by ID error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch invoice' }, { status: 500 });
  }
}

// PUT /api/invoices/[id] — Update invoice status/notes
export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'invoices.create');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const body = await request.json();
    const fields = [];
    const values = [];
    let idx = 1;

    if (body.status) { fields.push(`status = $${idx++}`); values.push(body.status); }
    if (body.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(body.notes); }
    if (body.file_url) { fields.push(`file_url = $${idx++}`); values.push(body.file_url); }
    fields.push(`updated_at = NOW()`);

    if (fields.length <= 1) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });

    values.push(id);
    const result = await query(
      `UPDATE invoices SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Invoices] PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update invoice' }, { status: 500 });
  }
}
