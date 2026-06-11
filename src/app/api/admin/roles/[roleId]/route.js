/**
 * GET /api/admin/roles/[roleId] - Get role with permissions, hierarchy, and authority
 * PUT /api/admin/roles/[roleId] - Update role and permissions
 * DELETE /api/admin/roles/[roleId] - Soft-delete custom role
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { logRbacEvent, extractRbacMetadata } from '@/lib/rbac-audit.js';
import { invalidateAllPermissionCaches } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { roleId } = await params;

    const roleResult = await query(
      `SELECT r.*, COALESCE(d.name, d.department_name) AS department_name
       FROM roles r LEFT JOIN departments d ON r.department_id = d.id
       WHERE r.id = $1`,
      [roleId]
    );
    if (!roleResult.rows[0]) {
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });
    }

    const permsResult = await query(
      `SELECT p.id, p.module, p.action, p.description, p.name AS perm_name, p.route_path, p.method
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = $1
       ORDER BY p.module, p.action`,
      [roleId]
    );

    const usersResult = await query(
      `SELECT u.id, u.name, u.email,
              COALESCE(s.name, s.full_name) AS staff_name,
              u.status AS account_status,
              COALESCE(d.name, d.department_name) AS department
       FROM staff_roles sr
       JOIN staff s ON sr.staff_id = s.id
       JOIN users u ON u.staff_id = s.id
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE sr.role_id = $1
       ORDER BY COALESCE(s.name, s.full_name) ASC`,
      [roleId]
    );

    return NextResponse.json({
      success: true,
      data: { ...roleResult.rows[0], permissions: permsResult.rows, assigned_users: usersResult.rows },
    });
  } catch (error) {
    console.error('Failed to fetch role:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch role' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { roleId } = await params;
    const body = await request.json();
    const { description, hierarchy_level, authority_level, department_id, alias, responsibilities } = body;
    // Accept both permissionIds and permission_ids
    const permissionIds = body.permissionIds || body.permission_ids;

    const updates = [];
    const values = [];
    let idx = 1;

    if (description !== undefined) {
      updates.push(`description = $${idx}`); values.push(description); idx++;
    }
    if (hierarchy_level !== undefined) {
      updates.push(`hierarchy_level = $${idx}`);
      values.push(Math.max(1, Math.min(100, parseInt(hierarchy_level) || 5)));
      idx++;
    }
    if (authority_level !== undefined) {
      updates.push(`authority_level = $${idx}`);
      values.push(Math.max(1, Math.min(100, parseInt(authority_level) || 20)));
      idx++;
    }
    if (department_id !== undefined) {
      updates.push(`department_id = $${idx}`); values.push(department_id || null); idx++;
    }
    if (alias !== undefined) {
      updates.push(`alias = $${idx}`); values.push(alias || null); idx++;
    }
    if (responsibilities !== undefined) {
      updates.push(`responsibilities = $${idx}`); values.push(responsibilities || null); idx++;
    }
    if (body.data_scope !== undefined) {
      const validScopes = ['OWN', 'DEPARTMENT', 'GLOBAL'];
      const scope = validScopes.includes(body.data_scope) ? body.data_scope : 'GLOBAL';
      updates.push(`data_scope = $${idx}`); values.push(scope); idx++;
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(roleId);
      await query(`UPDATE roles SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    }

    // Replace permissions if provided
    if (Array.isArray(permissionIds)) {
      await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
      if (permissionIds.length > 0) {
        const permValues = permissionIds.map((_, i) => `($1, $${i + 2})`).join(', ');
        await query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ${permValues} ON CONFLICT DO NOTHING`,
          [roleId, ...permissionIds]
        );
      }
    }

    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: 'role_updated',
      entityType: 'role',
      entityId: roleId,
      details: { permissionCount: permissionIds?.length, hierarchyLevel: hierarchy_level, authorityLevel: authority_level },
      ...meta,
    });

    invalidateAllPermissionCaches();

    dispatch('role_updated', {
      entityType: 'role', entityId: roleId,
      description: `Role was updated`,
      metadata: { hierarchy_level, authority_level },
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, message: 'Role updated' });
  } catch (error) {
    console.error('Failed to update role:', error);
    return NextResponse.json({ success: false, error: 'Failed to update role' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { roleId } = await params;

    const roleResult = await query('SELECT name, is_system FROM roles WHERE id = $1', [roleId]);
    if (!roleResult.rows[0]) {
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });
    }
    if (roleResult.rows[0].is_system) {
      return NextResponse.json({ success: false, error: 'Cannot delete system roles' }, { status: 400 });
    }

    const usersResult = await query(
      `SELECT COUNT(DISTINCT u.id) AS cnt
       FROM staff_roles sr
       JOIN staff s ON sr.staff_id = s.id
       JOIN users u ON u.staff_id = s.id
       WHERE sr.role_id = $1`,
      [roleId]
    );
    if (parseInt(usersResult.rows[0].cnt) > 0) {
      return NextResponse.json({ success: false, error: 'Cannot delete role with assigned users. Remove user assignments first.' }, { status: 400 });
    }

    // Soft-delete: mark is_active = false
    await query('UPDATE roles SET is_active = false, updated_at = NOW() WHERE id = $1', [roleId]);

    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: 'role_deleted',
      entityType: 'role',
      entityId: roleId,
      details: { roleName: roleResult.rows[0].name },
      ...meta,
    });

    invalidateAllPermissionCaches();

    dispatch('role_deleted', {
      entityType: 'role', entityId: roleId,
      description: `Role "${roleResult.rows[0].name}" was deactivated`,
      metadata: { name: roleResult.rows[0].name },
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, message: 'Role deactivated' });
  } catch (error) {
    console.error('Failed to delete role:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete role' }, { status: 500 });
  }
}
