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
      return NextResponse.json({ success: false, error: 'Suspension reason is required' }, { status: 400 });

    const r = await query(
      `UPDATE licenses
         SET status = 'suspended', suspended_at = NOW(), suspended_reason = $1
       WHERE id = $2 AND status NOT IN ('revoked','expired') RETURNING *`,
      [reason, id]
    );
    if (!r.rows.length)
      return NextResponse.json({ success: false, error: 'License not found or cannot be suspended' }, { status: 404 });

    const { ip, ua } = clientFromRequest(request);
    await logLicenseEvent({
      license_id: id, event_type: 'suspended', actor_id: auth.userId,
      description: `License suspended: ${reason}`, after_state: { status: 'suspended' },
      metadata: { reason },
    });
    await logLicenseAudit({
      license_id: id, action: 'suspend', actor_id: auth.userId,
      ip_address: ip, user_agent: ua, details: { reason },
    });
    return NextResponse.json({ success: true, data: r.rows[0] });
  } catch (e) {
    console.error('[Licenses] suspend error:', e);
    return NextResponse.json({ success: false, error: 'Failed to suspend license' }, { status: 500 });
  }
}
