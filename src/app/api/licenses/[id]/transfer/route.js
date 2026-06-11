import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { logLicenseEvent, logLicenseAudit, clientFromRequest } from '@/lib/license-engine.js';

// Body: { new_client_id, new_client_name?, reason }
export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'licenses.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const { new_client_id, new_client_name, reason } = await request.json().catch(() => ({}));

    if (!new_client_id && !new_client_name)
      return NextResponse.json({ success: false, error: 'new_client_id or new_client_name required' }, { status: 400 });
    if (!reason || !reason.trim())
      return NextResponse.json({ success: false, error: 'Transfer reason required' }, { status: 400 });

    let resolvedName = new_client_name;
    if (new_client_id) {
      const c = await query('SELECT company_name FROM clients WHERE id = $1', [new_client_id]);
      if (!c.rows.length) return NextResponse.json({ success: false, error: 'New client not found' }, { status: 400 });
      resolvedName = resolvedName || c.rows[0].company_name;
    }

    const before = await query('SELECT client_id, client_name FROM licenses WHERE id = $1', [id]);
    if (!before.rows.length) return NextResponse.json({ success: false, error: 'License not found' }, { status: 404 });

    const r = await query(
      `UPDATE licenses SET client_id = $1, client_name = $2 WHERE id = $3 RETURNING *`,
      [new_client_id || null, resolvedName, id]
    );

    // Reset all devices on transfer (security policy)
    await query('UPDATE license_devices SET is_active = false WHERE license_id = $1', [id]);

    const { ip, ua } = clientFromRequest(request);
    await logLicenseEvent({
      license_id: id, event_type: 'transferred', actor_id: auth.userId,
      description: `License transferred to ${resolvedName}`,
      before_state: before.rows[0],
      after_state: { client_id: new_client_id, client_name: resolvedName },
      metadata: { reason },
    });
    await logLicenseAudit({
      license_id: id, action: 'transfer', actor_id: auth.userId,
      ip_address: ip, user_agent: ua,
      details: { from: before.rows[0], to: { client_id: new_client_id, client_name: resolvedName }, reason },
    });

    return NextResponse.json({ success: true, data: r.rows[0] });
  } catch (e) {
    console.error('[Licenses] transfer error:', e);
    return NextResponse.json({ success: false, error: 'Failed to transfer license' }, { status: 500 });
  }
}
