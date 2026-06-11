import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { Events } from '@/lib/events.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/systems/[id]/issues
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const result = await query(
      `SELECT * FROM system_issues WHERE system_id = $1 ORDER BY reported_at DESC`,
      [id]
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Issues] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch issues' }, { status: 500 });
  }
}

// POST /api/systems/[id]/issues
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
      `INSERT INTO system_issues (system_id, title, description, status) VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, title, description || null, status || 'open']
    );
    await Events.issueReported(result.rows[0].id, result.rows[0].title, id, auth.userId);
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Issues] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create issue' }, { status: 500 });
  }
}

// PATCH /api/systems/[id]/issues — update a specific issue
export async function PATCH(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { issue_id, status, resolved_at } = body;

    if (!issue_id) return NextResponse.json({ success: false, error: 'issue_id required' }, { status: 400 });

    const result = await query(
      `UPDATE system_issues SET status=$1, resolved_at=$2 WHERE id=$3 RETURNING *`,
      [status, resolved_at || (status === 'fixed' || status === 'closed' ? new Date().toISOString() : null), issue_id]
    );
    if (result.rows[0] && (status === 'fixed' || status === 'closed')) {
      await Events.issueFixed(issue_id, result.rows[0].title, result.rows[0].system_id, auth.userId);
    }
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Issues] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update issue' }, { status: 500 });
  }
}
