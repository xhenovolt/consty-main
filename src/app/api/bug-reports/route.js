import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';

// GET /api/bug-reports — List bugs with filtering
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const system_id = searchParams.get('system_id');
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');

    let sql = `SELECT b.*, s.name as system_name, 
               u1.name as reporter_name, u2.name as assignee_name
               FROM bug_reports b
               LEFT JOIN systems s ON b.system_id = s.id
               LEFT JOIN users u1 ON b.reported_by_user = u1.id
               LEFT JOIN users u2 ON b.assigned_developer = u2.id
               WHERE 1=1`;
    const params = [];
    if (system_id) { params.push(system_id); sql += ` AND b.system_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND b.status = $${params.length}`; }
    if (severity) { params.push(severity); sql += ` AND b.severity = $${params.length}`; }
    sql += ` ORDER BY b.created_at DESC`;

    const result = await query(sql, params);

    // Compute metrics
    const metrics = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'open') as open_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
        COUNT(*) FILTER (WHERE severity = 'critical' AND status NOT IN ('resolved','closed')) as critical_open,
        AVG(EXTRACT(EPOCH FROM time_to_resolve)/3600) FILTER (WHERE time_to_resolve IS NOT NULL) as avg_resolution_hours
      FROM bug_reports
    `);

    return NextResponse.json({ success: true, data: result.rows, metrics: metrics.rows[0] });
  } catch (error) {
    console.error('[BugReports] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch bug reports' }, { status: 500 });
  }
}

// POST /api/bug-reports — Create bug report
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { system_id, title, description, severity, module_affected, assigned_developer } = body;
    if (!system_id || !title) return NextResponse.json({ success: false, error: 'system_id and title required' }, { status: 400 });

    const result = await query(
      `INSERT INTO bug_reports (system_id, title, description, severity, module_affected, reported_by_user, assigned_developer)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [system_id, title, description || null, severity || 'medium', module_affected || null, auth.userId, assigned_developer || null]
    );

    dispatch('bug_reported', { entityType: 'bug_report', entityId: result.rows[0].id, description: `Bug reported: ${title}`, metadata: { title, severity: severity || 'medium', system_id }, actorId: auth.userId }).catch(() => {});

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[BugReports] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create bug report' }, { status: 500 });
  }
}

// PUT /api/bug-reports — Update bug status
export async function PUT(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { id, status, assigned_developer } = body;
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    const fields = [];
    const values = [];
    let idx = 1;

    if (status) {
      fields.push(`status = $${idx++}`); values.push(status);
      if (status === 'resolved' || status === 'closed') {
        fields.push(`resolved_at = NOW()`);
        fields.push(`time_to_resolve = NOW() - created_at`);
      }
    }
    if (assigned_developer !== undefined) { fields.push(`assigned_developer = $${idx++}`); values.push(assigned_developer || null); }

    values.push(id);
    const result = await query(`UPDATE bug_reports SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Bug not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[BugReports] PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update bug report' }, { status: 500 });
  }
}
