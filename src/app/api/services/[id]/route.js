import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/services/[id]
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'services.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const result = await query(
      `SELECT s.*,
        (SELECT COUNT(*) FROM deals d WHERE d.service_id = s.id) as deal_count,
        COALESCE((SELECT SUM(d.total_amount) FROM deals d WHERE d.service_id = s.id AND d.status NOT IN ('cancelled','disputed')), 0) as total_revenue,
        (SELECT json_agg(row_to_json(d.*)) FROM (
          SELECT d.id, d.title, d.total_amount, d.currency, d.status,
            COALESCE(c.company_name, d.client_name, 'Unknown') as client_label,
            d.created_at
          FROM deals d
          LEFT JOIN clients c ON d.client_id = c.id
          WHERE d.service_id = $1
          ORDER BY d.created_at DESC LIMIT 20
        ) d) as deals
      FROM services s WHERE s.id = $1`,
      [id]
    );
    if (!result.rows.length) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Services/id] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch service' }, { status: 500 });
  }
}

// PUT /api/services/[id]
export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'services.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const body = await request.json();
    const { name, description, service_type, price, currency, is_active } = body;

    const result = await query(
      `UPDATE services SET name=$1, description=$2, service_type=$3, price=$4, currency=$5, is_active=$6
       WHERE id=$7 RETURNING *`,
      [name, description || null, service_type, price || null, currency || 'UGX', is_active !== false, id]
    );
    if (!result.rows.length) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Services/id] PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update service' }, { status: 500 });
  }
}

// DELETE /api/services/[id]
export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'services.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    await query(`UPDATE services SET is_active=false WHERE id=$1`, [id]);
    return NextResponse.json({ success: true, message: 'Service deactivated' });
  } catch (error) {
    console.error('[Services/id] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to deactivate service' }, { status: 500 });
  }
}
