/**
 * GET /api/admin/roles - List all roles with permission counts, hierarchy, and authority
 * POST /api/admin/roles - Create a new custom role
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { logRbacEvent, extractRbacMetadata } from '@/lib/rbac-audit.js';
import { invalidateAllPermissionCaches } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const result = await query(`
      SELECT r.id, r.name, r.description, r.is_system, r.is_active,
        r.hierarchy_level, r.authority_level, r.department_id, r.alias,
        r.responsibilities, r.created_by, r.created_at, r.updated_at,
        COALESCE(r.data_scope, 'GLOBAL') AS data_scope,
        COALESCE(d.name, d.department_name) AS department_name,
        (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count,
        (SELECT COUNT(DISTINCT u.id) FROM staff_roles sr JOIN staff s ON sr.staff_id = s.id JOIN users u ON u.staff_id = s.id WHERE sr.role_id = r.id) AS user_count
      FROM roles r
      LEFT JOIN departments d ON r.department_id = d.id
      WHERE r.is_active = true
      ORDER BY r.authority_level DESC, r.hierarchy_level ASC, r.name ASC
    `);

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to fetch roles:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch roles' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { name, description, hierarchy_level, authority_level, department_id, alias, responsibilities } = body;
    // Accept both permissionIds and permission_ids for backward compatibility
    const permissionIds = body.permissionIds || body.permission_ids || [];

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Role name is required' }, { status: 400 });
    }

    const sanitizedName = name.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
    const hLevel = Math.max(1, Math.min(100, parseInt(hierarchy_level) || 5));
    const aLevel = Math.max(1, Math.min(100, parseInt(authority_level) || 20));

    const roleResult = await query(
      `INSERT INTO roles (name, description, is_system, hierarchy_level, authority_level, department_id, alias, responsibilities, created_by)
       VALUES ($1, $2, false, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, description, hierarchy_level, authority_level, department_id, alias, is_active`,
      [sanitizedName, description || '', hLevel, aLevel, department_id || null, alias || null, responsibilities || null, auth.userId]
    );

    const role = roleResult.rows[0];

    // Assign permissions if provided
    if (permissionIds.length > 0) {
      const values = permissionIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        [role.id, ...permissionIds]
      );
    }

    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: 'role_created',
      entityType: 'role',
      entityId: role.id,
      details: { roleName: role.name, hierarchyLevel: hLevel, authorityLevel: aLevel, permissionCount: permissionIds.length },
      ...meta,
    });

    invalidateAllPermissionCaches();

    dispatch('role_created', {
      entityType: 'role', entityId: role.id,
      description: `Role "${role.name}" was created (authority: ${aLevel})`,
      metadata: { name: role.name, hierarchy_level: hLevel, authority_level: aLevel },
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, data: role }, { status: 201 });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'Role name already exists' }, { status: 409 });
    }
    console.error('Failed to create role:', error);
    return NextResponse.json({ success: false, error: 'Failed to create role' }, { status: 500 });
  }
}
