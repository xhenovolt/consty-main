import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/events?event_type=&entity_type=&entity_id=&limit=&page=
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const event_type  = searchParams.get('event_type');
    const entity_type = searchParams.get('entity_type');
    const entity_id   = searchParams.get('entity_id');
    const limit       = Math.min(parseInt(searchParams.get('limit')  || '50', 10), 200);
    const page        = Math.max(parseInt(searchParams.get('page')   || '1',  10), 1);
    const offset      = (page - 1) * limit;

    let sql = `SELECT e.*, u.name as created_by_name
               FROM events e
               LEFT JOIN users u ON e.created_by = u.id
               WHERE 1=1`;
    const params = [];

    if (event_type)  { params.push(event_type);  sql += ` AND e.event_type  = $${params.length}`; }
    if (entity_type) { params.push(entity_type); sql += ` AND e.entity_type = $${params.length}`; }
    if (entity_id)   { params.push(entity_id);   sql += ` AND e.entity_id   = $${params.length}`; }

    sql += ` ORDER BY e.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Count total for pagination
    let countSql = `SELECT COUNT(*) FROM events e WHERE 1=1`;
    const countParams = [];
    if (event_type)  { countParams.push(event_type);  countSql += ` AND e.event_type  = $${countParams.length}`; }
    if (entity_type) { countParams.push(entity_type); countSql += ` AND e.entity_type = $${countParams.length}`; }
    if (entity_id)   { countParams.push(entity_id);   countSql += ` AND e.entity_id   = $${countParams.length}`; }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[Events] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch events' }, { status: 500 });
  }
}

// POST /api/events — manual event logging (admin use / testing)
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { event_type, entity_type, entity_id, description, metadata } = await request.json();
    if (!event_type) return NextResponse.json({ success: false, error: 'event_type is required' }, { status: 400 });

    const result = await query(
      `INSERT INTO events (event_type, entity_type, entity_id, description, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [event_type, entity_type || null, entity_id || null, description || null,
       metadata ? JSON.stringify(metadata) : '{}', auth.userId]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Events] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create event' }, { status: 500 });
  }
}
