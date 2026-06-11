import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/followups
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'prospects.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const prospect_id = searchParams.get('prospect_id');
    const upcoming = searchParams.get('upcoming'); // 'true' for future only

    let sql = `SELECT f.*, p.company_name as prospect_name, p.contact_name as prospect_contact
               FROM followups f JOIN prospects p ON f.prospect_id = p.id WHERE 1=1`;
    const params = [];

    if (status) { params.push(status); sql += ` AND f.status = $${params.length}`; }
    if (prospect_id) { params.push(prospect_id); sql += ` AND f.prospect_id = $${params.length}`; }
    if (upcoming === 'true') { sql += ` AND f.scheduled_at >= NOW() AND f.status = 'scheduled'`; }

    sql += ` ORDER BY f.scheduled_at ASC`;
    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Followups] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch followups' }, { status: 500 });
  }
}

// POST /api/followups
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'prospects.create');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { prospect_id, type, scheduled_at, summary, next_action } = body;
    if (!prospect_id || !type || !scheduled_at) {
      return NextResponse.json({ success: false, error: 'prospect_id, type, and scheduled_at are required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO followups (prospect_id, type, scheduled_at, summary, next_action, performed_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [prospect_id, type, scheduled_at, summary||null, next_action||null, auth.userId]
    );

    // Update prospect's next_followup_date
    await query(`UPDATE prospects SET next_followup_date = $1::date WHERE id = $2`, [scheduled_at, prospect_id]);

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Followups] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create followup' }, { status: 500 });
  }
}
