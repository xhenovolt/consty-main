import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { logLicenseEvent, logLicenseAudit, clientFromRequest } from '@/lib/license-engine.js';

export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'licenses.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const { reason } = await request.json().catch(() => ({}));

    if (!reason || !reason.trim())
      return NextResponse.json({ success: false, error: 'Revocation reason is required' }, { status: 400 });

    const r = await query(
      `UPDATE licenses
         SET status = 'revoked', revoked_at = NOW(), revoked_reason = $1
       WHERE id = $2 RETURNING *`,
      [reason, id]
    );
    if (!r.rows.length) return NextResponse.json({ success: false, error: 'License not found' }, { status: 404 });

    // Disable all devices
    await query('UPDATE license_devices SET is_active = false WHERE license_id = $1', [id]);

    const { ip, ua } = clientFromRequest(request);
    await logLicenseEvent({
      license_id: id, event_type: 'revoked', actor_id: auth.userId,
      description: `License revoked: ${reason}`, after_state: { status: 'revoked' },
      metadata: { reason },
    });
    await logLicenseAudit({
      license_id: id, action: 'revoke', actor_id: auth.userId,
      ip_address: ip, user_agent: ua, details: { reason },
    });
    return NextResponse.json({ success: true, data: r.rows[0] });
  } catch (e) {
    console.error('[Licenses] revoke error:', e);
    return NextResponse.json({ success: false, error: 'Failed to revoke license' }, { status: 500 });
  }
}
