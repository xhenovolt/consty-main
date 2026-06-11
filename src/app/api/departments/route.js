import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/departments — list all departments with counts
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'departments.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const active_only = searchParams.get('active_only') !== 'false';
    const search = searchParams.get('search');

    let sql = `
      SELECT d.*,
        COALESCE(d.name, d.department_name) AS display_name,
        (SELECT COUNT(*) FROM staff s WHERE (s.department_id = d.id OR s.department = COALESCE(d.name, d.department_name)) AND s.status = 'active') AS staff_count,
        (SELECT COUNT(*) FROM roles r WHERE r.department_id = d.id) AS role_count,
        (SELECT COUNT(*) FROM department_policies dp WHERE dp.department_id = d.id AND dp.is_active = true) AS policy_count,
        (SELECT COUNT(*) FROM department_kpis dk WHERE dk.department_id = d.id AND dk.is_active = true) AS kpi_count,
        (SELECT COUNT(*) FROM department_processes dpr WHERE dpr.department_id = d.id AND dpr.status = 'active') AS process_count,
        (SELECT COUNT(*) FROM department_documents dd WHERE dd.department_id = d.id) AS document_count,
        p.name AS parent_name,
        COALESCE(hu.full_name, hu.name) AS head_name
      FROM departments d
      LEFT JOIN departments p ON d.parent_department_id = p.id
      LEFT JOIN users hu ON d.head_user_id = hu.id
      WHERE 1=1
    `;
    const params = [];
    if (active_only) { sql += ` AND d.is_active = true`; }
    if (search) { params.push(`%${search}%`); sql += ` AND (COALESCE(d.name, d.department_name) ILIKE $${params.length} OR d.alias ILIKE $${params.length})`; }
    sql += ` ORDER BY COALESCE(d.name, d.department_name) ASC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Departments] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch departments' }, { status: 500 });
  }
}

// POST /api/departments — create department
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'departments.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { name, description, alias, parent_department_id, head_user_id, color, icon } = body;
    if (!name?.trim()) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });

    const result = await query(
      `INSERT INTO departments (name, department_name, description, alias, parent_department_id, head_user_id, color, icon)
       VALUES ($1,$1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name.trim(), description || null, alias || null, parent_department_id || null, head_user_id || null, color || '#3b82f6', icon || null]
    );

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'department', result.rows[0].id, JSON.stringify({ name: name.trim() })]);

    dispatch('department_created', {
      entityType: 'department', entityId: result.rows[0].id,
      description: `Department "${name.trim()}" was created`, actorId: auth.userId,
    });

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (error.code === '23505') return NextResponse.json({ success: false, error: 'Department already exists' }, { status: 409 });
    console.error('[Departments] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create department' }, { status: 500 });
  }
}
