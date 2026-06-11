import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { logLicenseEvent, logLicenseAudit, clientFromRequest } from '@/lib/license-engine.js';

// Body: { duration_days?, new_expires_at?, amount?, currency?, payment_id?, notes? }
export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'licenses.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const cur = await query('SELECT * FROM licenses WHERE id = $1', [id]);
    if (!cur.rows.length) return NextResponse.json({ success: false, error: 'License not found' }, { status: 404 });
    const lic = cur.rows[0];

    let newExpires;
    if (body.new_expires_at) {
      newExpires = new Date(body.new_expires_at);
    } else if (body.duration_days) {
      const base = lic.expires_at && new Date(lic.expires_at) > new Date()
        ? new Date(lic.expires_at) : new Date();
      newExpires = new Date(base.getTime() + body.duration_days * 86400000);
    } else {
      return NextResponse.json({ success: false, error: 'duration_days or new_expires_at required' }, { status: 400 });
    }

    const r = await query(
      `UPDATE licenses
         SET expires_at = $1, end_date = $2,
             status = CASE WHEN status IN ('expired','suspended') THEN 'active' ELSE status END,
             suspended_at = CASE WHEN status = 'suspended' THEN NULL ELSE suspended_at END,
             suspended_reason = CASE WHEN status = 'suspended' THEN NULL ELSE suspended_reason END
       WHERE id = $3 RETURNING *`,
      [newExpires, newExpires.toISOString().slice(0, 10), id]
    );

    await query(
      `INSERT INTO license_renewals
         (license_id, previous_expires_at, new_expires_at, duration_days, amount, currency, payment_id, renewed_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id, lic.expires_at, newExpires,
        body.duration_days || null, body.amount || null, body.currency || 'UGX',
        body.payment_id || null, auth.userId, body.notes || null,
      ]
    );

    const { ip, ua } = clientFromRequest(request);
    await logLicenseEvent({
      license_id: id, event_type: 'renewed', actor_id: auth.userId,
      description: `License renewed until ${newExpires.toISOString().slice(0,10)}`,
      before_state: { expires_at: lic.expires_at },
      after_state: { expires_at: newExpires },
      metadata: { amount: body.amount, currency: body.currency },
    });
    await logLicenseAudit({
      license_id: id, action: 'renew', actor_id: auth.userId,
      ip_address: ip, user_agent: ua,
      details: { previous_expires_at: lic.expires_at, new_expires_at: newExpires, amount: body.amount },
    });

    return NextResponse.json({ success: true, data: r.rows[0] });
  } catch (e) {
    console.error('[Licenses] renew error:', e);
    return NextResponse.json({ success: false, error: 'Failed to renew license' }, { status: 500 });
  }
}
