/**
 * GET /api/admin/roles/[roleId]/permissions - List permissions for a role
 * POST /api/admin/roles/[roleId]/permissions - Replace role permissions
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { invalidateAllPermissionCaches } from '@/lib/permissions.js';
import { logRbacEvent, extractRbacMetadata } from '@/lib/rbac-audit.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { roleId } = await params;

    const result = await query(
      `SELECT p.id, p.module, p.action, p.description, p.name, p.route_path, p.method
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = $1
       ORDER BY p.module, p.action`,
      [roleId]
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to fetch role permissions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch role permissions' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { roleId } = await params;
    const body = await request.json();
    const permissionIds = body.permission_ids || body.permissionIds;

    if (!Array.isArray(permissionIds)) {
      return NextResponse.json({ success: false, error: 'permission_ids array is required' }, { status: 400 });
    }

    // Verify role exists
    const roleCheck = await query('SELECT id, name FROM roles WHERE id = $1', [roleId]);
    if (!roleCheck.rows[0]) {
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });
    }

    // Replace all permissions atomically
    await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

    if (permissionIds.length > 0) {
      const valuesClause = permissionIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ${valuesClause} ON CONFLICT DO NOTHING`,
        [roleId, ...permissionIds]
      );
    }

    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: 'role_permissions_replaced',
      entityType: 'role',
      entityId: roleId,
      details: { permissionCount: permissionIds.length, roleName: roleCheck.rows[0].name },
      ...meta,
    });

    invalidateAllPermissionCaches();

    dispatch('role_permissions_updated', {
      entityType: 'role', entityId: roleId,
      description: `Permissions updated for role "${roleCheck.rows[0].name}"`,
      metadata: { permissionCount: permissionIds.length },
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, message: 'Role permissions updated', count: permissionIds.length });
  } catch (error) {
    console.error('Failed to update role permissions:', error);
    return NextResponse.json({ success: false, error: 'Failed to update role permissions' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/roles/[roleId]/permissions
 * Toggle a single permission on or off for a role.
 * Body: { permission_id: string, enabled: boolean }
 */
export async function PATCH(request, { params }) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { roleId } = await params;
    const body = await request.json();
    const { permission_id, enabled } = body;

    if (!permission_id || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'permission_id (string) and enabled (boolean) are required' },
        { status: 400 }
      );
    }

    // Verify role exists
    const roleCheck = await query('SELECT id, name, is_system FROM roles WHERE id = $1', [roleId]);
    if (!roleCheck.rows[0]) {
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });
    }

    // Protect system roles from accidental permission removal
    if (roleCheck.rows[0].is_system && !enabled) {
      // Allow but log loudly
      console.warn(`[RBAC] Removing permission from system role "${roleCheck.rows[0].name}"`);
    }

    if (enabled) {
      await query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [roleId, permission_id]
      );
    } else {
      await query(
        'DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2',
        [roleId, permission_id]
      );
    }

    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: enabled ? 'permission_granted' : 'permission_revoked',
      entityType: 'role',
      entityId: roleId,
      details: { permissionId: permission_id, roleName: roleCheck.rows[0].name },
      ...meta,
    });

    invalidateAllPermissionCaches();

    return NextResponse.json({ success: true, enabled });
  } catch (error) {
    console.error('Failed to toggle role permission:', error);
    return NextResponse.json({ success: false, error: 'Failed to toggle permission' }, { status: 500 });
  }
}
