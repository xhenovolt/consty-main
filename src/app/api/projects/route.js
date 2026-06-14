import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { projectVisibilityFilter } from '@/lib/project-access.js';

// GET /api/projects — list (admins: all; others: only projects they belong to)
export async function GET(request) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let sql = `
      SELECT p.*,
        gov.name  AS governor_name,
        mgr.name  AS manager_name,
        cl.company_name AS client_name,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id AND pm.status='active') AS member_count,
        (SELECT COUNT(*) FROM work_items wi WHERE wi.project_id = p.id) AS work_item_count,
        (SELECT COUNT(*) FROM blockers b WHERE b.project_id = p.id AND b.status <> 'resolved') AS open_blockers
      FROM projects p
      LEFT JOIN users gov   ON gov.id = p.governor_id
      LEFT JOIN users mgr   ON mgr.id = p.manager_id
      LEFT JOIN clients cl  ON cl.id = p.client_id
      WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); sql += ` AND p.status = $${params.length}`; }
    if (search) { params.push(`%${search}%`); sql += ` AND (p.name ILIKE $${params.length} OR p.code ILIKE $${params.length})`; }

    const vis = projectVisibilityFilter(auth, params.length);
    sql += vis.clause; params.push(...vis.params);
    sql += ` ORDER BY p.created_at DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Projects] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST /api/projects — create; creator becomes a 'manager' member automatically
export async function POST(request) {
  const perm = await requirePermission(request, 'projects', 'create');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  try {
    const body = await request.json();
    const {
      code, name, description, category, type, client_id,
      governor_id, manager_id, priority, currency, location,
      planned_start, planned_end,
    } = body;

    if (!name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    const projectCode = (code && code.trim()) || `PRJ-${Date.now().toString(36).toUpperCase()}`;

    const result = await query(
      `INSERT INTO projects
         (code, name, description, category, type, client_id, governor_id, manager_id,
          priority, currency, location, planned_start, planned_end, status, created_by)
       VALUES ($1,$2,$3,$4,COALESCE($5,'construction'),$6,$7,COALESCE($8,$15),
               COALESCE($9,'medium'),COALESCE($10,'UGX'),$11,$12,$13,'planning',$15)
       RETURNING *`,
      [projectCode, name, description || null, category || null, type || null, client_id || null,
       governor_id || null, manager_id || null, priority || null, currency || null, location || null,
       planned_start || null, planned_end || null, null, auth.userId]
    );
    const project = result.rows[0];

    // Make the creator (or named manager) a project manager so they retain access.
    const managerUser = manager_id || auth.userId;
    await query(
      `INSERT INTO project_members (project_id, user_id, project_role, created_by)
       VALUES ($1,$2,'manager',$3)
       ON CONFLICT (project_id, user_id, project_role) DO NOTHING`,
      [project.id, managerUser, auth.userId]
    );
    if (governor_id && governor_id !== managerUser) {
      await query(
        `INSERT INTO project_members (project_id, user_id, project_role, created_by)
         VALUES ($1,$2,'governor',$3) ON CONFLICT (project_id, user_id, project_role) DO NOTHING`,
        [project.id, governor_id, auth.userId]
      );
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'CREATE','project',$2,$3)`,
      [auth.userId, project.id, JSON.stringify({ code: project.code, name: project.name })]
    ).catch(() => {});

    return NextResponse.json({ success: true, data: project }, { status: 201 });
  } catch (error) {
    console.error('[Projects] POST error:', error);
    if (error.code === '23505') return NextResponse.json({ success: false, error: 'Project code already exists' }, { status: 409 });
    return NextResponse.json({ success: false, error: 'Failed to create project' }, { status: 500 });
  }
}
