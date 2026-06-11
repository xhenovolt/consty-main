import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/systems/[id]/changes
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const result = await query(
      `SELECT * FROM system_changes WHERE system_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Changes] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch changes' }, { status: 500 });
  }
}

// POST /api/systems/[id]/changes
export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const body = await request.json();
    const { title, description, status } = body;

    if (!title) return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });

    const result = await query(
      `INSERT INTO system_changes (system_id, title, description, status) VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, title, description || null, status || 'planned']
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Changes] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create change' }, { status: 500 });
  }
}

// PATCH /api/systems/[id]/changes — update status of a change
export async function PATCH(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { change_id, status } = body;

    if (!change_id) return NextResponse.json({ success: false, error: 'change_id required' }, { status: 400 });

    const result = await query(
      `UPDATE system_changes SET status=$1, completed_at=$2 WHERE id=$3 RETURNING *`,
      [status, status === 'completed' ? new Date().toISOString() : null, change_id]
    );
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Changes] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update change' }, { status: 500 });
  }
}
