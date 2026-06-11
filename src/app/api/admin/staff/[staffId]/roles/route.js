/**
 * GET  /api/admin/staff/[staffId]/roles - List roles assigned to a staff member
 * POST /api/admin/staff/[staffId]/roles - Replace all role assignments for a staff member
 * DELETE /api/admin/staff/[staffId]/roles - Remove a single role from a staff member
 *
 * Uses the staff_roles table for staff-level role assignments.
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { logRbacEvent, extractRbacMetadata } from '@/lib/rbac-audit.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission, hasPermission } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'staff.update');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { staffId } = await params;

    const result = await query(
      `SELECT r.id, r.name, r.description, r.hierarchy_level, r.authority_level,
              r.is_system, r.department_id,
              COALESCE(d.name, d.department_name) AS department_name,
              sr.assigned_by, sr.assigned_at
       FROM staff_roles sr
       JOIN roles r ON sr.role_id = r.id
       LEFT JOIN departments d ON r.department_id = d.id
       WHERE sr.staff_id = $1
       ORDER BY r.authority_level DESC`,
      [staffId]
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to fetch staff roles:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch staff roles' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'staff.update');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { staffId } = await params;
    const body = await request.json();
    const roleIds = body.role_ids || body.roleIds || [];

    if (!Array.isArray(roleIds)) {
      return NextResponse.json({ success: false, error: 'role_ids must be an array' }, { status: 400 });
    }

    // Authority check — a role with staff.assign_any_role (superadmins
    // satisfy this via the cache bypass) can assign any role. Without it,
    // the assigner can only grant roles strictly BELOW their own authority.
    const canAssignAny = await hasPermission(auth.userId, 'staff', 'assign_any_role', auth.role);
    if (!canAssignAny && roleIds.length > 0) {
      const assignerAuth = await query(
        `SELECT MAX(r.authority_level) AS max_authority
         FROM users u
         JOIN staff s ON u.staff_id = s.id
         JOIN staff_roles sr ON sr.staff_id = s.id
         JOIN roles r ON sr.role_id = r.id
         WHERE u.id = $1`,
        [auth.userId]
      );
      const assignerAuthority = assignerAuth.rows[0]?.max_authority || 0;

      const targetRoles = await query(
        `SELECT id, name, authority_level FROM roles WHERE id = ANY($1)`,
        [roleIds]
      );
      for (const role of targetRoles.rows) {
        if (role.authority_level >= assignerAuthority) {
          return NextResponse.json({
            success: false,
            error: `Cannot assign role "${role.name}" (authority ${role.authority_level}) — exceeds your authority level (${assignerAuthority})`,
          }, { status: 403 });
        }
      }
    }

    // Get previous roles for logging
    const prevRoles = await query(
      `SELECT role_id FROM staff_roles WHERE staff_id = $1`,
      [staffId]
    );
    const previousRoleIds = prevRoles.rows.map(r => r.role_id);

    // Remove all previous assignments
    await query('DELETE FROM staff_roles WHERE staff_id = $1', [staffId]);

    // Insert new assignments
    let assigned = 0;
    for (const roleId of roleIds) {
      await query(
        `INSERT INTO staff_roles (staff_id, role_id, assigned_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (staff_id, role_id) DO NOTHING`,
        [staffId, roleId, auth.userId]
      );
      assigned++;
    }

    // Also update the primary role_id on staff record (first role)
    if (roleIds.length > 0) {
      await query('UPDATE staff SET role_id = $1, updated_at = NOW() WHERE id = $2', [roleIds[0], staffId]);
    } else {
      await query('UPDATE staff SET role_id = NULL, updated_at = NOW() WHERE id = $1', [staffId]);
    }

    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: 'staff_roles_replaced',
      entityType: 'staff',
      entityId: staffId,
      details: { previousRoleIds, newRoleIds: roleIds, assigned },
      ...meta,
    });

    dispatch('role_assigned', {
      entityType: 'staff', entityId: staffId,
      description: `Role assignments updated for staff member (${assigned} role(s))`,
      metadata: { roleIds, assignedBy: auth.userId },
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, message: `${assigned} role(s) assigned`, assigned });
  } catch (error) {
    console.error('Failed to assign staff roles:', error);
    return NextResponse.json({ success: false, error: 'Failed to assign staff roles' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'staff.update');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { staffId } = await params;
    const { role_id } = await request.json();

    if (!role_id) {
      return NextResponse.json({ success: false, error: 'role_id is required' }, { status: 400 });
    }

    await query('DELETE FROM staff_roles WHERE staff_id = $1 AND role_id = $2', [staffId, role_id]);

    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: 'staff_role_removed',
      entityType: 'staff',
      entityId: staffId,
      details: { roleId: role_id },
      ...meta,
    });

    dispatch('role_removed', {
      entityType: 'staff', entityId: staffId,
      description: `Role removed from staff member`,
      metadata: { roleId: role_id, removedBy: auth.userId },
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, message: 'Role removed from staff' });
  } catch (error) {
    console.error('Failed to remove staff role:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove staff role' }, { status: 500 });
  }
}
