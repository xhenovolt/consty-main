import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission, buildDataScopeFilter } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';

// GET /api/prospects - List all prospects (data-scope enforced)
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'prospects', 'view');
    if (perm instanceof NextResponse) return perm;
    const { auth, dataScope, departmentId } = perm;

    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage');
    const source = searchParams.get('source');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));
    const offset = (page - 1) * limit;

    const params = [];
    let sql = `SELECT p.*, 
      (SELECT COUNT(*) FROM followups f WHERE f.prospect_id = p.id) as followup_count,
      (SELECT COUNT(*) FROM prospect_contacts pc WHERE pc.prospect_id = p.id) as contact_count,
      s.name as system_name,
      sv.name as service_name
      FROM prospects p
      LEFT JOIN systems s ON p.system_id = s.id
      LEFT JOIN services sv ON p.service_id = sv.id
      WHERE 1=1`;

    if (stage) { params.push(stage); sql += ` AND p.stage = $${params.length}`; }
    if (source) { params.push(source); sql += ` AND p.source = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (p.company_name ILIKE $${params.length} OR p.contact_name ILIKE $${params.length} OR p.email ILIKE $${params.length})`;
    }

    // ── Data scope enforcement ───────────────────────────────────────────────
    const scopeFilter = buildDataScopeFilter({
      dataScope: dataScope ?? 'GLOBAL',
      userId: auth.userId,
      departmentId,
      tableAlias: 'p',
      paramOffset: params.length,
    });
    sql += scopeFilter.clause;
    params.push(...scopeFilter.params);

    const countSql = sql.replace(/SELECT p\.\*.*?FROM prospects p/s, 'SELECT COUNT(*) FROM prospects p');
    const countParams = [...params];

    sql += ` ORDER BY p.created_at DESC`;
    params.push(limit); sql += ` LIMIT $${params.length}`;
    params.push(offset); sql += ` OFFSET $${params.length}`;

    const [result, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams),
    ]);
    const total = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[Prospects] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch prospects' }, { status: 500 });
  }
}

// POST /api/prospects - Create new prospect
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'prospects', 'create');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { company_name, contact_name, email, phone, website, industry, source, stage, priority, estimated_value, estimated_value_text, currency, notes, tags, pipeline, next_followup_date, next_followup_time, system_id, service_id } = body;

    // Either a title or company_name is required for quick capture
    const name = company_name || body.title;
    if (!name) return NextResponse.json({ success: false, error: 'company_name or title is required' }, { status: 400 });

    const result = await query(
      `INSERT INTO prospects (company_name, contact_name, email, phone, website, industry, source, stage, priority, estimated_value, estimated_value_text, currency, notes, tags, pipeline, next_followup_date, next_followup_time, system_id, service_id, created_by, assigned_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20) RETURNING *`,
      [name, contact_name||null, email||null, phone||null, website||null, industry||null,
       source||null, stage||'new', priority||'medium', estimated_value||null, estimated_value_text||null, currency||'UGX', notes||null, tags||'{}', pipeline||null, next_followup_date||null, next_followup_time||null, system_id||null, service_id||null, auth.userId]
    );

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'prospect', result.rows[0].id, JSON.stringify({ company_name })]);

    dispatch('prospect_created', { entityType: 'prospect', entityId: result.rows[0].id, description: `Prospect created: ${name}`, metadata: { name, stage: stage || 'new', estimated_value }, actorId: auth.userId }).catch(() => {});

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Prospects] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create prospect' }, { status: 500 });
  }
}
