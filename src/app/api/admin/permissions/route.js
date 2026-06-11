/**
 * GET /api/admin/permissions - List all permissions grouped by module
 * POST /api/admin/permissions - Create a new permission
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { getAllPermissionsGrouped, invalidateAllPermissionCaches } from '@/lib/permissions.js';
import { logRbacEvent, extractRbacMetadata } from '@/lib/rbac-audit.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { flat, grouped } = await getAllPermissionsGrouped();

    return NextResponse.json({ success: true, data: flat, grouped });
  } catch (error) {
    console.error('Failed to fetch permissions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch permissions' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { module, action, description, name, route_path, method } = await request.json();

    if (!module || !action) {
      return NextResponse.json({ success: false, error: 'module and action are required' }, { status: 400 });
    }

    // Check duplicate
    const existing = await query(
      'SELECT id FROM permissions WHERE module = $1 AND action = $2',
      [module, action]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ success: false, error: 'Permission already exists for this module.action' }, { status: 409 });
    }

    const result = await query(
      `INSERT INTO permissions (module, action, description, name, route_path, method)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [module, action, description || null, name || `${module}.${action}`, route_path || null, method || null]
    );

    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: 'permission_created',
      entityType: 'permission',
      entityId: result.rows[0].id,
      details: { module, action },
      ...meta,
    });

    invalidateAllPermissionCaches();

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Failed to create permission:', error);
    return NextResponse.json({ success: false, error: 'Failed to create permission' }, { status: 500 });
  }
}
