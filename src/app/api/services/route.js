import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/services
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'services.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const active = searchParams.get('active');

    let sql = `
      SELECT s.*,
        (SELECT COUNT(*) FROM deals d WHERE d.service_id = s.id) as deal_count,
        COALESCE((SELECT SUM(d.total_amount) FROM deals d WHERE d.service_id = s.id AND d.status NOT IN ('cancelled','disputed')), 0) as total_revenue
      FROM services s
      WHERE 1=1
    `;
    const params = [];
    if (type) { params.push(type); sql += ` AND s.service_type = $${params.length}`; }
    if (active !== null && active !== undefined) { params.push(active === 'true'); sql += ` AND s.is_active = $${params.length}`; }
    sql += ` ORDER BY s.created_at DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Services] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch services' }, { status: 500 });
  }
}

// POST /api/services
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'services.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { name, description, service_type, price, currency } = body;

    if (!name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    if (!service_type || !['one_time', 'recurring'].includes(service_type)) {
      return NextResponse.json({ success: false, error: 'service_type must be one_time or recurring' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO services (name, description, service_type, price, currency)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, description || null, service_type, price || null, currency || 'UGX']
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Services] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create service' }, { status: 500 });
  }
}
