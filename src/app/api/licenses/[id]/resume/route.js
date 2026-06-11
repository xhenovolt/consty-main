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

    const r = await query(
      `UPDATE licenses
         SET status = 'active', suspended_at = NULL, suspended_reason = NULL
       WHERE id = $1 AND status = 'suspended' RETURNING *`,
      [id]
    );
    if (!r.rows.length)
      return NextResponse.json({ success: false, error: 'License is not suspended' }, { status: 404 });

    const { ip, ua } = clientFromRequest(request);
    await logLicenseEvent({
      license_id: id, event_type: 'resumed', actor_id: auth.userId,
      description: 'License resumed from suspension', after_state: { status: 'active' },
    });
    await logLicenseAudit({
      license_id: id, action: 'resume', actor_id: auth.userId,
      ip_address: ip, user_agent: ua, details: {},
    });
    return NextResponse.json({ success: true, data: r.rows[0] });
  } catch (e) {
    console.error('[Licenses] resume error:', e);
    return NextResponse.json({ success: false, error: 'Failed to resume license' }, { status: 500 });
  }
}
