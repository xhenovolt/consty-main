import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/system-events — Browse system activity (admin/founder view)
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));
    const offset = (page - 1) * limit;

    const event_name = searchParams.get('event_name');
    const entity_type = searchParams.get('entity_type');
    const actor_id = searchParams.get('actor_id');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');

    let where = 'WHERE 1=1';
    const params = [];

    if (event_name) { params.push(event_name); where += ` AND se.event_name = $${params.length}`; }
    if (entity_type) { params.push(entity_type); where += ` AND se.entity_type = $${params.length}`; }
    if (actor_id) { params.push(actor_id); where += ` AND se.actor_user_id = $${params.length}`; }
    if (date_from) { params.push(date_from); where += ` AND se.created_at >= $${params.length}::date`; }
    if (date_to) { params.push(date_to); where += ` AND se.created_at < ($${params.length}::date + interval '1 day')`; }

    const [rows, countResult] = await Promise.all([
      query(
        `SELECT se.*, u.name as actor_name, u.full_name as actor_full_name, u.email as actor_email
         FROM system_events se
         LEFT JOIN users u ON se.actor_user_id = u.id
         ${where}
         ORDER BY se.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) as total FROM system_events se ${where}`, params),
    ]);

    const total = parseInt(countResult.rows[0]?.total || 0);

    return NextResponse.json({
      success: true,
      data: rows.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[SystemEvents] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch system events' }, { status: 500 });
  }
}
