import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { logLicenseEvent, logLicenseAudit, clientFromRequest, diffStates } from '@/lib/license-engine.js';

async function loadLicense(id) {
  const r = await query(
    `SELECT l.*,
            s.name AS system_name,
            c.company_name AS client_company,
            d.total_amount AS deal_value, d.currency AS deal_currency,
            p.name AS plan_name,
            u.full_name AS issued_by_name
     FROM licenses l
     LEFT JOIN systems s ON l.system_id = s.id
     LEFT JOIN clients c ON l.client_id = c.id
     LEFT JOIN deals   d ON l.deal_id   = d.id
     LEFT JOIN pricing_plans p ON l.plan_id = p.id
     LEFT JOIN users   u ON l.issued_by = u.id
     WHERE l.id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'licenses.view');
    if (perm instanceof NextResponse) return perm;
    const { id } = await params;

    const license = await loadLicense(id);
    if (!license) return NextResponse.json({ success: false, error: 'License not found' }, { status: 404 });

    const [devices, domains, events, renewals, features, activations] = await Promise.all([
      query('SELECT * FROM license_devices    WHERE license_id = $1 ORDER BY last_seen_at DESC', [id]),
      query('SELECT * FROM license_domains    WHERE license_id = $1 ORDER BY created_at DESC',   [id]),
      query('SELECT * FROM license_events     WHERE license_id = $1 ORDER BY created_at DESC LIMIT 50', [id]),
      query('SELECT * FROM license_renewals   WHERE license_id = $1 ORDER BY created_at DESC',   [id]),
      query('SELECT * FROM license_feature_access WHERE license_id = $1 ORDER BY feature_key',   [id]),
      query('SELECT * FROM license_activations WHERE license_id = $1 ORDER BY activated_at DESC LIMIT 50', [id]),
    ]);

    return NextResponse.json({
      success: true,
      license,
      devices: devices.rows,
      domains: domains.rows,
      events: events.rows,
      renewals: renewals.rows,
      features: features.rows,
      activations: activations.rows,
    });
  } catch (e) {
    console.error('[Licenses] GET [id] error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load license' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const perm = await requirePermission(request, 'licenses.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;

    const before = await loadLicense(id);
    if (!before) return NextResponse.json({ success: false, error: 'License not found' }, { status: 404 });

    const body = await request.json();
    const fields = [
      'notes','max_users','max_devices','installation_type','support_level',
      'expires_at','end_date','start_date','metadata','client_name','plan_id','subscription_id',
    ];
    const updates = [];
    const values = [];
    for (const f of fields) {
      if (body[f] !== undefined) {
        updates.push(`${f} = $${values.length + 1}`);
        values.push(f === 'metadata' ? JSON.stringify(body[f]) : body[f]);
      }
    }
    if (!updates.length) return NextResponse.json({ success: false, error: 'No updatable fields supplied' }, { status: 400 });

    values.push(id);
    const r = await query(
      `UPDATE licenses SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    const after = r.rows[0];

    const { ip, ua } = clientFromRequest(request);
    await logLicenseEvent({
      license_id: id,
      event_type: 'updated',
      actor_id: auth.userId,
      description: 'License updated',
      before_state: before,
      after_state: after,
      metadata: { changes: diffStates(before, after) },
    });
    await logLicenseAudit({
      license_id: id, action: 'update', actor_id: auth.userId,
      ip_address: ip, user_agent: ua, details: diffStates(before, after),
    });

    return NextResponse.json({ success: true, data: after });
  } catch (e) {
    console.error('[Licenses] PATCH [id] error:', e);
    return NextResponse.json({ success: false, error: 'Failed to update license' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'licenses.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;

    const r = await query('DELETE FROM licenses WHERE id = $1 RETURNING id', [id]);
    if (!r.rows.length) return NextResponse.json({ success: false, error: 'License not found' }, { status: 404 });

    const { ip, ua } = clientFromRequest(request);
    await logLicenseAudit({
      license_id: id, action: 'delete', actor_id: auth.userId,
      ip_address: ip, user_agent: ua, details: {},
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[Licenses] DELETE [id] error:', e);
    return NextResponse.json({ success: false, error: 'Failed to delete license' }, { status: 500 });
  }
}
