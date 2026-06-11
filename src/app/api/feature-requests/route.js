import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/feature-requests — List feature requests
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const system_id = searchParams.get('system_id');
    const status = searchParams.get('status');

    let sql = `SELECT f.*, s.name as system_name, u.name as assignee_name
               FROM feature_requests f
               LEFT JOIN systems s ON f.system_id = s.id
               LEFT JOIN users u ON f.assigned_developer = u.id
               WHERE 1=1`;
    const params = [];
    if (system_id) { params.push(system_id); sql += ` AND f.system_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND f.status = $${params.length}`; }
    sql += ` ORDER BY f.created_at DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch feature requests' }, { status: 500 });
  }
}

// POST /api/feature-requests — Create feature request
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { system_id, feature_title, description, priority, assigned_developer, requested_by } = body;
    if (!system_id || !feature_title) return NextResponse.json({ success: false, error: 'system_id and feature_title required' }, { status: 400 });

    const result = await query(
      `INSERT INTO feature_requests (system_id, feature_title, description, priority, requested_by, assigned_developer)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [system_id, feature_title, description || null, priority || 'medium', requested_by || null, assigned_developer || null]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create feature request' }, { status: 500 });
  }
}

// PUT /api/feature-requests — Update feature request
export async function PUT(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { id, status, assigned_developer, priority } = body;
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    const fields = [];
    const values = [];
    let idx = 1;
    if (status) { fields.push(`status = $${idx++}`); values.push(status); if (status === 'completed') fields.push(`resolved_at = NOW()`); }
    if (assigned_developer !== undefined) { fields.push(`assigned_developer = $${idx++}`); values.push(assigned_developer || null); }
    if (priority) { fields.push(`priority = $${idx++}`); values.push(priority); }

    values.push(id);
    const result = await query(`UPDATE feature_requests SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update feature request' }, { status: 500 });
  }
}
