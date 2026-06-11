import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/systems/[id]/plans — get pricing plans for a system
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = params;
    const result = await query(
      `SELECT * FROM system_pricing_plans WHERE system_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [id]
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Plans] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch plans' }, { status: 500 });
  }
}

// POST /api/systems/[id]/plans — create a pricing plan for a system
export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = params;
    const body = await request.json();
    const { name, description, installation_fee, monthly_fee, annual_fee, currency, billing_cycle, features, max_users, is_active, sort_order } = body;

    if (!name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });

    // Verify system exists
    const systemCheck = await query(`SELECT id FROM systems WHERE id = $1`, [id]);
    if (systemCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'System not found' }, { status: 404 });
    }

    const result = await query(
      `INSERT INTO system_pricing_plans 
        (system_id, name, description, installation_fee, monthly_fee, annual_fee, currency, billing_cycle, features, max_users, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        id, name, description || null,
        installation_fee != null ? parseFloat(installation_fee) : 0,
        monthly_fee != null ? parseFloat(monthly_fee) : null,
        annual_fee != null ? parseFloat(annual_fee) : null,
        currency || 'UGX',
        billing_cycle || 'monthly',
        features ? JSON.stringify(features) : '[]',
        max_users || null,
        is_active !== false,
        sort_order || 0,
      ]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'system_pricing_plan', result.rows[0].id,
       JSON.stringify({ system_id: id, name, installation_fee, monthly_fee })]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Plans] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create plan' }, { status: 500 });
  }
}
