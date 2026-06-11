import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * GET /api/decision-logs — List decision log entries with filters
 */
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'activity_logs.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const department_id = searchParams.get('department_id');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit')) || 50, 200);
    const offset = parseInt(searchParams.get('offset')) || 0;

    const conditions = ['1=1'];
    const params = [];

    if (category) { params.push(category); conditions.push(`dl.category = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`dl.status = $${params.length}`); }
    if (department_id) { params.push(department_id); conditions.push(`dl.department_id = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`(dl.title ILIKE $${params.length} OR dl.description ILIKE $${params.length})`); }

    params.push(limit, offset);

    const result = await query(
      `SELECT dl.*, u.name as decided_by_name, d.name as department_name,
              (SELECT COUNT(*) FROM record_comments rc WHERE rc.entity_type = 'decision_log' AND rc.entity_id = dl.id) as comment_count
       FROM decision_logs dl
       LEFT JOIN users u ON dl.decided_by = u.id
       LEFT JOIN departments d ON dl.department_id = d.id
       WHERE ${conditions.join(' AND ')} AND dl.is_archived = false
       ORDER BY dl.decision_date DESC, dl.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM decision_logs dl WHERE ${conditions.join(' AND ')} AND dl.is_archived = false`,
      params.slice(0, -2)
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (error) {
    console.error('[DecisionLogs] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch decision logs' }, { status: 500 });
  }
}

/**
 * POST /api/decision-logs — Create a decision log entry
 */
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'activity_logs.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { title, description, category, priority, status, decision_date, context, alternatives, consequences, stakeholders, related_entity_type, related_entity_id, tags, department_id } = body;

    if (!title?.trim()) return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });

    const result = await query(
      `INSERT INTO decision_logs (title, description, category, priority, status, decision_date, context, alternatives, consequences, stakeholders, related_entity_type, related_entity_id, tags, department_id, decided_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        title.trim(),
        description || null,
        category || 'general',
        priority || 'medium',
        status || 'decided',
        decision_date || new Date().toISOString().slice(0, 10),
        context || null,
        alternatives || null,
        consequences || null,
        stakeholders || [],
        related_entity_type || null,
        related_entity_id || null,
        tags || [],
        department_id || null,
        auth.userId,
      ]
    );

    dispatch('decision_logged', {
      entityType: 'decision_log',
      entityId: result.rows[0].id,
      description: `Decision logged: "${title.trim()}"`,
      actorId: auth.userId,
      metadata: { category: category || 'general', priority: priority || 'medium' },
    });

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[DecisionLogs] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create decision log' }, { status: 500 });
  }
}
