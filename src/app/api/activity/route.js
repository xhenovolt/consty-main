import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission, getUserAuthorityLevel, buildAuthorityFilter } from '@/lib/permissions.js';

// GET /api/activity — get recent activity logs (hierarchy-filtered)
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'activity_logs.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    // Resolve viewer's authority level — superadmin gets 100
    const viewerAuthority = auth.role === 'superadmin' ? 100 : await getUserAuthorityLevel(auth.userId);

    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const action = searchParams.get('action');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

    // Build authority filter: viewer only sees records where actor_authority_level <= viewer's level
    const { clause: authorityClause, params, nextIdx } = buildAuthorityFilter(viewerAuthority, {
      actorAuthorityCol: 'al.actor_authority_level',
      startIdx: 1,
    });

    let sql = `
      SELECT al.*,
             u.name  AS user_name,
             u.email AS user_email,
             r.name  AS actor_role_name,
             r.authority_level AS actor_authority_level_from_role
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN roles r ON al.actor_role_id = r.id
       WHERE ${authorityClause}
    `;
    let idx = nextIdx;

    if (user_id) { params.push(user_id); sql += ` AND al.user_id = $${idx++}`; }
    if (action)  { params.push(action);  sql += ` AND al.action = $${idx++}`; }

    params.push(limit);
    sql += ` ORDER BY al.created_at DESC LIMIT $${idx}`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Activity] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch activity logs' }, { status: 500 });
  }
}

// POST /api/activity — log an activity event (records actor authority)
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { action, entity_type, entity_id, route, page_title, details } = body;

    // Resolve actor's authority level and primary role for audit
    let actorAuthorityLevel = 0;
    let actorRoleId = null;
    try {
      if (auth.role === 'superadmin') {
        actorAuthorityLevel = 100;
      } else {
        const authorityResult = await query(
          `SELECT r.id AS role_id, r.authority_level
             FROM users u
             JOIN staff s ON u.staff_id = s.id
             JOIN staff_roles sr ON sr.staff_id = s.id
             JOIN roles r ON sr.role_id = r.id
            WHERE u.id = $1
            ORDER BY r.authority_level DESC
            LIMIT 1`,
          [auth.userId]
        );
        if (authorityResult.rows[0]) {
          actorRoleId = authorityResult.rows[0].role_id;
          actorAuthorityLevel = authorityResult.rows[0].authority_level;
        }
      }
    } catch (_) { /* non-fatal: log anyway with level 0 */ }

    const result = await query(
      `INSERT INTO activity_logs
         (user_id, action, entity_type, entity_id, route, page_title, details, actor_role_id, actor_authority_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        auth.userId,
        action || 'page_view',
        entity_type || null,
        entity_id   || null,
        route       || null,
        page_title  || null,
        details ? JSON.stringify(details) : '{}',
        actorRoleId,
        actorAuthorityLevel,
      ]
    );

    return NextResponse.json({ success: true, id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    console.error('[Activity] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to log activity' }, { status: 500 });
  }
}
