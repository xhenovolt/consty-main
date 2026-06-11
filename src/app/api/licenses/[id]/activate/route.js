import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { logLicenseEvent, logLicenseAudit, clientFromRequest } from '@/lib/license-engine.js';

// POST /api/licenses/[id]/activate
// Body: { device_fingerprint?, device_name?, os?, hostname? }
export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'licenses.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { ip, ua } = clientFromRequest(request);

    const cur = await query('SELECT * FROM licenses WHERE id = $1', [id]);
    if (!cur.rows.length) return NextResponse.json({ success: false, error: 'License not found' }, { status: 404 });
    const lic = cur.rows[0];

    if (lic.revoked_at) return NextResponse.json({ success: false, error: 'License is revoked' }, { status: 409 });
    if (lic.expires_at && new Date(lic.expires_at) < new Date())
      return NextResponse.json({ success: false, error: 'License has expired' }, { status: 409 });

    // Enforce max_devices when device fingerprint provided
    let deviceId = null;
    if (body.device_fingerprint) {
      const existingDevices = await query(
        'SELECT id FROM license_devices WHERE license_id = $1 AND is_active',
        [id]
      );
      const existing = await query(
        'SELECT id FROM license_devices WHERE license_id = $1 AND device_fingerprint = $2',
        [id, body.device_fingerprint]
      );
      if (!existing.rows.length) {
        if (lic.max_devices && existingDevices.rows.length >= lic.max_devices) {
          await query(
            `INSERT INTO license_activations (license_id, activation_token, activated_by, ip_address, user_agent, status, failure_reason)
             VALUES ($1,$2,$3,$4,$5,'failed',$6)`,
            [id, lic.activation_token || '', auth.userId, ip, ua, 'max_devices_reached']
          );
          return NextResponse.json({
            success: false, error: 'Device limit reached for this license',
          }, { status: 409 });
        }
        const dev = await query(
          `INSERT INTO license_devices (license_id, device_fingerprint, device_name, os, hostname, ip_address)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [id, body.device_fingerprint, body.device_name || null, body.os || null, body.hostname || null, ip]
        );
        deviceId = dev.rows[0].id;
      } else {
        deviceId = existing.rows[0].id;
        await query(`UPDATE license_devices SET last_seen_at = NOW(), ip_address = $1 WHERE id = $2`, [ip, deviceId]);
      }
    }

    const updated = await query(
      `UPDATE licenses
         SET activated_at = COALESCE(activated_at, NOW()),
             status = CASE WHEN status IN ('pending','trial') THEN 'active' ELSE status END
       WHERE id = $1 RETURNING *`,
      [id]
    );

    await query(
      `INSERT INTO license_activations
        (license_id, activation_token, activated_by, ip_address, user_agent, device_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,'success')`,
      [id, lic.activation_token || '', auth.userId, ip, ua, deviceId]
    );

    await logLicenseEvent({
      license_id: id, event_type: 'activated', actor_id: auth.userId,
      description: 'License activated', after_state: { status: 'active' },
      metadata: { device_id: deviceId, ip },
    });
    await logLicenseAudit({
      license_id: id, action: 'activate', actor_id: auth.userId,
      ip_address: ip, user_agent: ua, details: { device_fingerprint: body.device_fingerprint || null },
    });

    return NextResponse.json({ success: true, data: updated.rows[0], device_id: deviceId });
  } catch (e) {
    console.error('[Licenses] activate error:', e);
    return NextResponse.json({ success: false, error: 'Failed to activate license' }, { status: 500 });
  }
}
