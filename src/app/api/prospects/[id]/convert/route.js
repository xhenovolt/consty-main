import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// POST /api/prospects/[id]/convert - Convert prospect to client
export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'prospects.update');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    
    // Get prospect
    const prospect = await query(`SELECT * FROM prospects WHERE id = $1`, [id]);
    if (!prospect.rows[0]) return NextResponse.json({ success: false, error: 'Prospect not found' }, { status: 404 });
    
    const p = prospect.rows[0];
    
    // Check if already converted
    const existing = await query(`SELECT id FROM clients WHERE prospect_id = $1`, [id]);
    if (existing.rows[0]) {
      return NextResponse.json({ success: false, error: 'Prospect already converted', client_id: existing.rows[0].id }, { status: 409 });
    }

    // Create client from prospect data
    const body = await request.json().catch(() => ({}));
    const client = await query(
      `INSERT INTO clients (prospect_id, company_name, contact_name, email, phone, website, industry, billing_address, tax_id, payment_terms, preferred_currency, notes, tags, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [id, p.company_name, p.contact_name, p.email, p.phone, p.website, p.industry,
       body.billing_address||null, body.tax_id||null, body.payment_terms||30,
       p.currency||'UGX', p.notes, p.tags||'{}', auth.userId]
    );

    // Update prospect stage to 'won'
    await query(`UPDATE prospects SET stage = 'won', converted_at = NOW() WHERE id = $1`, [id]);

    // Audit log
    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CONVERT', 'prospect', id, JSON.stringify({ client_id: client.rows[0].id, company_name: p.company_name })]);

    return NextResponse.json({ success: true, data: client.rows[0], message: 'Prospect converted to client' }, { status: 201 });
  } catch (error) {
    console.error('[Prospects] Convert error:', error);
    return NextResponse.json({ success: false, error: 'Failed to convert prospect' }, { status: 500 });
  }
}
