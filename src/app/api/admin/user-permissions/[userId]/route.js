/**
 * GET /api/admin/user-permissions/[userId]
 * Returns the full permission set for any user. Superadmin / roles.manage only.
 *
 * Response:
 *   { success: true, data: { user, roles, permissions, byModule,
 *                            dataScope, departmentId,
 *                            allowedRoutes, blockedRoutes } }
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission, getUserPermissions, getUserDataScope, getUserDepartmentId } from '@/lib/permissions.js';
import { getAllValidRoutes } from '@/lib/navigation-config.js';

export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'roles.manage');
  if (perm instanceof NextResponse) return perm;

  const { userId } = await params;

  try {
    // User info
    const userResult = await query(
      `SELECT u.id, u.email, u.name, u.role, u.status, u.is_active, u.created_at,
              s.first_name, s.last_name, s.position, s.department_id
       FROM users u
       LEFT JOIN staff s ON u.staff_id = s.id
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const user = userResult.rows[0];
    const isSuperadmin = user.role === 'superadmin';

    // Assigned roles (via staff_roles chain, with data_scope)
    const rolesResult = await query(
      `SELECT r.id, r.name, r.description, r.hierarchy_level, r.authority_level,
              COALESCE(r.data_scope, 'GLOBAL') as data_scope
       FROM users u
       JOIN staff s ON u.staff_id = s.id
       JOIN staff_roles sr ON sr.staff_id = s.id
       JOIN roles r ON sr.role_id = r.id
       WHERE u.id = $1
       ORDER BY r.hierarchy_level ASC`,
      [userId]
    );
    const roles = rolesResult.rows;

    // Fallback roles via users.role if staff chain is empty
    let fallbackRoles = [];
    if (roles.length === 0) {
      const fb = await query(
        `SELECT r.id, r.name, r.description, r.hierarchy_level, r.authority_level,
                COALESCE(r.data_scope, 'GLOBAL') as data_scope
         FROM roles r WHERE r.name = $1`,
        [user.role]
      );
      fallbackRoles = fb.rows;
    }
    const effectiveRoles = roles.length > 0 ? roles : fallbackRoles;

    // Effective permissions
    let permissions = [];
    let dataScope = 'GLOBAL';
    let departmentId = user.department_id;
    if (isSuperadmin) {
      permissions = ['*'];
    } else {
      [permissions, dataScope, departmentId] = await Promise.all([
        getUserPermissions(userId),
        getUserDataScope(userId),
        getUserDepartmentId(userId).then(d => d ?? user.department_id),
      ]);
    }

    // Group permissions by module
    const byModule = {};
    if (permissions[0] === '*') {
      byModule['*'] = ['All permissions (superadmin)'];
    } else {
      for (const p of permissions) {
        const [mod, action] = p.split('.');
        if (!byModule[mod]) byModule[mod] = [];
        byModule[mod].push(action);
      }
    }

    // Compute allowed and blocked routes from navigation config
    const allRoutes = getAllValidRoutes().filter(r => r.protected);
    const allowedRoutes = [];
    const blockedRoutes = [];

    if (isSuperadmin) {
      allRoutes.forEach(r => allowedRoutes.push(r));
    } else {
      for (const route of allRoutes) {
        // Determine required permission for this route from navigation config
        const { getRoutePermission } = await import('@/lib/navigation-config.js');
        const required = getRoutePermission(route.path);
        if (!required) {
          allowedRoutes.push({ ...route, required: null, reason: 'open' });
          continue;
        }
        const [mod] = required.split('.');
        const hasExact = permissions.includes(required);
        const hasModule = permissions.some(p => p.startsWith(`${mod}.`));
        if (hasExact || hasModule) {
          allowedRoutes.push({ ...route, required });
        } else {
          blockedRoutes.push({ ...route, required, reason: `Missing ${required}` });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name || `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email,
          role: user.role,
          status: user.status,
          is_active: user.is_active,
          is_superadmin: isSuperadmin,
          position: user.position,
        },
        roles: effectiveRoles,
        permissions,
        byModule,
        dataScope,
        departmentId,
        allowedRoutes,
        blockedRoutes,
      },
    });
  } catch (error) {
    console.error('Permission inspect error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch user permissions' }, { status: 500 });
  }
}
