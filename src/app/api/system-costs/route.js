import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/system-costs?system_id=xxx
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'systems.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const system_id = searchParams.get('system_id');

    let sql = `SELECT sc.*, s.name as system_name FROM system_costs sc LEFT JOIN systems s ON sc.system_id = s.id WHERE 1=1`;
    const params = [];
    if (system_id) { params.push(system_id); sql += ` AND sc.system_id = $${params.length}`; }
    sql += ` ORDER BY sc.cost_date DESC`;

    const result = await query(sql, params);

    // Also return summary per system
    const summary = await query(`
      SELECT sc.system_id, s.name as system_name,
        COUNT(*) as entry_count,
        SUM(sc.amount) as total_cost,
        MAX(sc.cost_date) as last_entry
      FROM system_costs sc LEFT JOIN systems s ON sc.system_id = s.id
      ${system_id ? 'WHERE sc.system_id = $1' : ''}
      GROUP BY sc.system_id, s.name ORDER BY total_cost DESC
    `, system_id ? [system_id] : []);

    return NextResponse.json({ success: true, data: result.rows, summary: summary.rows });
  } catch (error) {
    console.error('[SystemCosts] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch system costs' }, { status: 500 });
  }
}

// POST /api/system-costs
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { system_id, cost_type, amount, currency, cost_date, description, notes } = body;

    if (!system_id || !cost_type || !amount) {
      return NextResponse.json({ success: false, error: 'system_id, cost_type, and amount are required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO system_costs (system_id, cost_type, amount, currency, cost_date, description, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [system_id, cost_type, amount, currency || 'UGX', cost_date || new Date().toISOString().split('T')[0],
       description || null, notes || null, auth.userId]
    );

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'system_cost', result.rows[0].id, JSON.stringify({ system_id, cost_type, amount })]);

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[SystemCosts] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create system cost' }, { status: 500 });
  }
}

// DELETE /api/system-costs?id=xxx
export async function DELETE(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    await query(`DELETE FROM system_costs WHERE id=$1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete system cost' }, { status: 500 });
  }
}
