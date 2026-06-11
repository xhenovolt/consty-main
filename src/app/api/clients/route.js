import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';

// GET /api/clients — clients.view
export async function GET(request) {
  const perm = await requirePermission(request, 'clients.view');
  if (perm instanceof NextResponse) return perm;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));
    const offset = (page - 1) * limit;
    let sql = `SELECT c.*, 
      (SELECT COUNT(*) FROM deals d WHERE d.client_id = c.id) as deal_count,
      (SELECT COALESCE(SUM(d.total_amount),0) FROM deals d WHERE d.client_id = c.id) as total_deal_value
      FROM clients c WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); sql += ` AND c.status = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (c.company_name ILIKE $${params.length} OR c.contact_name ILIKE $${params.length} OR c.email ILIKE $${params.length})`;
    }
    sql += ` ORDER BY c.created_at DESC`;
    // Count with same filters
    let countSql = `SELECT COUNT(*) FROM clients c WHERE 1=1`;
    const countParams = [];
    if (status) { countParams.push(status); countSql += ` AND c.status = $${countParams.length}`; }
    if (search) { countParams.push(`%${search}%`); countSql += ` AND (c.company_name ILIKE $${countParams.length} OR c.contact_name ILIKE $${countParams.length} OR c.email ILIKE $${countParams.length})`; }
    params.push(limit); sql += ` LIMIT $${params.length}`;
    params.push(offset); sql += ` OFFSET $${params.length}`;
    const [result, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams),
    ]);
    const total = parseInt(countResult.rows[0].count);
    return NextResponse.json({ success: true, data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('[Clients] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch clients' }, { status: 500 });
  }
}

// POST /api/clients — clients.create
export async function POST(request) {
  const perm = await requirePermission(request, 'clients.create');
  if (perm instanceof NextResponse) return perm;
  try {
    const body = await request.json();
    const { company_name, contact_name, email, phone, website, industry, billing_address, tax_id, payment_terms, preferred_currency, notes, tags } = body;
    if (!company_name) return NextResponse.json({ success: false, error: 'company_name is required' }, { status: 400 });

    const result = await query(
      `INSERT INTO clients (company_name, contact_name, email, phone, website, industry, billing_address, tax_id, payment_terms, preferred_currency, notes, tags, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [company_name, contact_name||null, email||null, phone||null, website||null, industry||null,
       billing_address||null, tax_id||null, payment_terms||30, preferred_currency||'UGX', notes||null, tags||'{}', auth.userId]
    );

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'client', result.rows[0].id, JSON.stringify({ company_name })]);

    dispatch('client_created', { entityType: 'client', entityId: result.rows[0].id, description: `Client created: ${company_name}`, metadata: { name: company_name }, actorId: auth.userId }).catch(() => {});

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Clients] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create client' }, { status: 500 });
  }
}
