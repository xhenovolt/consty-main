/**
 * PUT /api/admin/permissions/[permissionId] - Update permission
 * DELETE /api/admin/permissions/[permissionId] - Delete permission
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { invalidateAllPermissionCaches } from '@/lib/permissions.js';
import { logRbacEvent, extractRbacMetadata } from '@/lib/rbac-audit.js';
import { requirePermission } from '@/lib/permissions.js';

export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { permissionId } = await params;
    const { description, name, route_path, method } = await request.json();

    const existing = await query('SELECT id FROM permissions WHERE id = $1', [permissionId]);
    if (!existing.rows[0]) {
      return NextResponse.json({ success: false, error: 'Permission not found' }, { status: 404 });
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (description !== undefined) { updates.push(`description = $${idx}`); values.push(description); idx++; }
    if (name !== undefined) { updates.push(`name = $${idx}`); values.push(name); idx++; }
    if (route_path !== undefined) { updates.push(`route_path = $${idx}`); values.push(route_path); idx++; }
    if (method !== undefined) { updates.push(`method = $${idx}`); values.push(method); idx++; }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    values.push(permissionId);
    await query(`UPDATE permissions SET ${updates.join(', ')} WHERE id = $${idx}`, values);

    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: 'permission_updated',
      entityType: 'permission',
      entityId: permissionId,
      details: { description, name, route_path, method },
      ...meta,
    });

    invalidateAllPermissionCaches();

    return NextResponse.json({ success: true, message: 'Permission updated' });
  } catch (error) {
    console.error('Failed to update permission:', error);
    return NextResponse.json({ success: false, error: 'Failed to update permission' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { permissionId } = await params;

    const existing = await query('SELECT module, action FROM permissions WHERE id = $1', [permissionId]);
    if (!existing.rows[0]) {
      return NextResponse.json({ success: false, error: 'Permission not found' }, { status: 404 });
    }

    // Remove from role_permissions first, then delete
    await query('DELETE FROM role_permissions WHERE permission_id = $1', [permissionId]);
    await query('DELETE FROM permissions WHERE id = $1', [permissionId]);

    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: 'permission_deleted',
      entityType: 'permission',
      entityId: permissionId,
      details: { module: existing.rows[0].module, action: existing.rows[0].action },
      ...meta,
    });

    invalidateAllPermissionCaches();

    return NextResponse.json({ success: true, message: 'Permission deleted' });
  } catch (error) {
    console.error('Failed to delete permission:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete permission' }, { status: 500 });
  }
}
