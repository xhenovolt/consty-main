import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import {
  generateLicenseKey, generateActivationToken,
  logLicenseEvent, logLicenseAudit, clientFromRequest,
} from '@/lib/license-engine.js';

// GET /api/licenses — list with filters + summary stats
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'licenses.view');
    if (perm instanceof NextResponse) return perm;

    const { searchParams } = new URL(request.url);
    const system_id  = searchParams.get('system_id');
    const status     = searchParams.get('status');
    const client_id  = searchParams.get('client_id');
    const expiring   = searchParams.get('expiring');   // "30" → next 30 days
    const include    = searchParams.get('include');    // "stats"

    let sql = `
      SELECT l.*,
        s.name           AS system_name,
        c.company_name   AS client_company,
        d.total_amount   AS deal_value,
        d.currency       AS deal_currency,
        p.name           AS plan_name,
        u.full_name      AS issued_by_name,
        (SELECT COUNT(*) FROM license_devices ld WHERE ld.license_id = l.id AND ld.is_active) AS device_count,
        (SELECT COUNT(*) FROM license_activations la WHERE la.license_id = l.id) AS activation_count
      FROM licenses l
      LEFT JOIN systems   s ON l.system_id = s.id
      LEFT JOIN clients   c ON l.client_id = c.id
      LEFT JOIN deals     d ON l.deal_id   = d.id
      LEFT JOIN pricing_plans p ON l.plan_id = p.id
      LEFT JOIN users     u ON l.issued_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (system_id) { params.push(system_id); sql += ` AND l.system_id = $${params.length}`; }
    if (status)    { params.push(status);    sql += ` AND l.status    = $${params.length}`; }
    if (client_id) { params.push(client_id); sql += ` AND l.client_id = $${params.length}`; }
    if (expiring) {
      const days = parseInt(expiring, 10);
      if (Number.isFinite(days) && days > 0) {
        sql += ` AND l.expires_at IS NOT NULL
                 AND l.expires_at >= NOW()
                 AND l.expires_at <= NOW() + INTERVAL '${days} days'
                 AND l.status = 'active'`;
      }
    }
    sql += ` ORDER BY l.created_at DESC`;

    const result = await query(sql, params);

    let stats = null;
    if (include === 'stats') {
      const s = await query(`
        SELECT
          COUNT(*)                                        AS total,
          COUNT(*) FILTER (WHERE status = 'active')       AS active,
          COUNT(*) FILTER (WHERE status = 'trial')        AS trial,
          COUNT(*) FILTER (WHERE status = 'expired')      AS expired,
          COUNT(*) FILTER (WHERE status = 'suspended')    AS suspended,
          COUNT(*) FILTER (WHERE status = 'revoked')      AS revoked,
          COUNT(*) FILTER (WHERE expires_at IS NOT NULL
                             AND expires_at >= NOW()
                             AND expires_at <= NOW() + INTERVAL '30 days'
                             AND status = 'active')       AS expiring_soon
        FROM licenses
      `);
      stats = s.rows[0];
    }

    return NextResponse.json({ success: true, licenses: result.rows, stats });
  } catch (error) {
    console.error('[Licenses] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch licenses' }, { status: 500 });
  }
}

// POST /api/licenses — issue a new license
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'licenses.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const {
      system_id, deal_id, client_id, client_name, plan_id, subscription_id,
      license_type = 'lifetime',
      issued_date, issue_date,
      start_date, end_date, expires_at, expiry_date,
      max_users, max_devices, installation_type, support_level,
      allowed_domains, notes, status, metadata,
      is_historical, skip_backdated_warning,
    } = body;

    // Resolve dates
    const effectiveIssueDate = issue_date || issued_date || null;
    const effectiveExpires   = expires_at || end_date || expiry_date || null;

    if (!system_id && !deal_id) {
      return NextResponse.json({ success: false, error: 'system_id or deal_id is required' }, { status: 400 });
    }
    if (!client_id && !client_name) {
      return NextResponse.json({ success: false, error: 'client_id or client_name is required' }, { status: 400 });
    }

    // Resolve from deal if provided
    let resolvedSystemId = system_id || null;
    let resolvedClientId = client_id || null;
    let resolvedPlanId   = plan_id   || null;
    let resolvedClientName = client_name || 'Unknown';

    if (deal_id) {
      const dealRes = await query(
        `SELECT d.id, d.system_id, d.client_id, d.client_name, d.plan_id, c.company_name AS client_company
         FROM deals d LEFT JOIN clients c ON d.client_id = c.id
         WHERE d.id = $1`,
        [deal_id]
      );
      if (dealRes.rows.length) {
        const deal = dealRes.rows[0];
        resolvedSystemId   = resolvedSystemId   || deal.system_id || null;
        resolvedClientId   = resolvedClientId   || deal.client_id || null;
        resolvedPlanId     = resolvedPlanId     || deal.plan_id   || null;
        resolvedClientName = client_name || deal.client_name || deal.client_company || resolvedClientName;
      }
    }

    if (resolvedSystemId) {
      const sysCheck = await query('SELECT id FROM systems WHERE id = $1', [resolvedSystemId]);
      if (!sysCheck.rows.length) {
        return NextResponse.json({ success: false, error: 'system_id does not reference a valid system' }, { status: 400 });
      }
    }

    // Backdated warning
    if (effectiveIssueDate && !skip_backdated_warning) {
      const issueMs = new Date(effectiveIssueDate).getTime();
      if (issueMs < Date.now() - 86400000) {
        return NextResponse.json({
          success: false,
          error: 'backdated_license',
          message: 'You are creating a license in the past. Set skip_backdated_warning: true to proceed.',
          issue_date: effectiveIssueDate,
        }, { status: 409 });
      }
    }

    // Block duplicate active license per deal
    if (deal_id && !is_historical) {
      const existing = await query(
        `SELECT id FROM licenses WHERE deal_id = $1 AND status NOT IN ('revoked','expired') LIMIT 1`,
        [deal_id]
      );
      if (existing.rows.length) {
        return NextResponse.json({
          success: false,
          error: 'An active license already exists for this deal',
          existing_license_id: existing.rows[0].id,
        }, { status: 409 });
      }
    }

    // Generate unique license key (retry on collision — extremely unlikely)
    let licenseKey, attempts = 0;
    do {
      licenseKey = generateLicenseKey();
      const dup = await query('SELECT 1 FROM licenses WHERE license_key = $1', [licenseKey]);
      if (!dup.rows.length) break;
    } while (++attempts < 5);

    const activationToken = generateActivationToken();
    const initialStatus = status || (license_type === 'trial' ? 'trial' : 'pending');

    const result = await query(
      `INSERT INTO licenses (
        system_id, deal_id, client_id, client_name, plan_id, subscription_id,
        license_type, issued_date, is_historical,
        start_date, end_date, expires_at,
        max_users, max_devices, installation_type, support_level,
        allowed_domains, notes, status, metadata,
        license_key, activation_token, issued_by, auto_issued
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,
        $10,$11,$12,
        $13,$14,$15,$16,
        $17,$18,$19,$20,
        $21,$22,$23, false
      )
      RETURNING *`,
      [
        resolvedSystemId, deal_id || null, resolvedClientId, resolvedClientName, resolvedPlanId, subscription_id || null,
        license_type, effectiveIssueDate, !!is_historical,
        start_date || effectiveIssueDate || null, effectiveExpires, effectiveExpires,
        max_users || null, max_devices || null, installation_type || null, support_level || null,
        Array.isArray(allowed_domains) ? allowed_domains : null,
        notes || null, initialStatus, metadata ? JSON.stringify(metadata) : '{}',
        licenseKey, activationToken, auth.userId,
      ]
    );

    const license = result.rows[0];

    // Persist allowed_domains rows for query-ability
    if (Array.isArray(allowed_domains) && allowed_domains.length) {
      const values = allowed_domains.map((_, i) => `($1,$${i + 2},$${allowed_domains.length + 2})`).join(',');
      await query(
        `INSERT INTO license_domains (license_id, domain, added_by) VALUES ${values}
         ON CONFLICT DO NOTHING`,
        [license.id, ...allowed_domains, auth.userId]
      );
    }

    const { ip, ua } = clientFromRequest(request);
    await logLicenseEvent({
      license_id: license.id,
      event_type: 'issued',
      actor_id: auth.userId,
      description: `License issued to ${resolvedClientName}`,
      after_state: { status: initialStatus, license_key: licenseKey, license_type, expires_at: effectiveExpires },
      metadata: { system_id: resolvedSystemId, plan_id: resolvedPlanId, deal_id: deal_id || null },
    });
    await logLicenseAudit({
      license_id: license.id,
      action: 'issue',
      actor_id: auth.userId,
      ip_address: ip,
      user_agent: ua,
      details: { client_name: resolvedClientName, license_type, max_users, max_devices, installation_type },
    });

    return NextResponse.json({ success: true, data: license }, { status: 201 });
  } catch (error) {
    console.error('[Licenses] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create license: ' + error.message }, { status: 500 });
  }
}
