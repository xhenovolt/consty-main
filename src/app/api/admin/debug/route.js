/**
 * GET /api/admin/debug
 * Superadmin-only endpoint that surfaces identity integrity stats:
 *  - Total users / staff / roles
 *  - Linked users (staff_id set)
 *  - Orphan users (no staff_id)
 *  - Staff without users
 *  - Staff without roles
 *  - staff_roles count
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'users.view');
  if (perm instanceof NextResponse) return perm;

  // Only superadmin may access debug data
  if (perm.auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Superadmin only' }, { status: 403 });
  }

  try {
    const [
      totalUsers,
      totalStaff,
      totalRoles,
      linkedUsers,
      orphanUsers,
      staffWithoutUser,
      staffWithoutRole,
      staffRolesCount,
      activeUsers,
      pendingUsers,
    ] = await Promise.all([
      query('SELECT COUNT(*) AS cnt FROM users'),
      query('SELECT COUNT(*) AS cnt FROM staff'),
      query('SELECT COUNT(*) AS cnt FROM roles'),
      query('SELECT COUNT(*) AS cnt FROM users WHERE staff_id IS NOT NULL'),
      query('SELECT COUNT(*) AS cnt FROM users WHERE staff_id IS NULL'),
      query(`
        SELECT COUNT(*) AS cnt FROM staff s
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.staff_id = s.id)
          AND s.linked_user_id IS NULL
      `),
      query('SELECT COUNT(*) AS cnt FROM staff WHERE role_id IS NULL'),
      query('SELECT COUNT(*) AS cnt FROM staff_roles'),
      query("SELECT COUNT(*) AS cnt FROM users WHERE is_active = true AND status = 'active'"),
      query("SELECT COUNT(*) AS cnt FROM users WHERE status = 'pending'"),
    ]);

    // Get orphan user list
    const orphanList = await query(`
      SELECT id, username, email, name, role, authority_level, created_at
      FROM users WHERE staff_id IS NULL ORDER BY created_at DESC
    `);

    // Get staff without user list
    const staffNoUserList = await query(`
      SELECT s.id, s.name, s.email, s.role_id, r.name AS role_name
      FROM staff s
      LEFT JOIN roles r ON s.role_id = r.id
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.staff_id = s.id)
        AND s.linked_user_id IS NULL
    `);

    // Get staff without role
    const staffNoRoleList = await query(`
      SELECT id, name, email FROM staff WHERE role_id IS NULL
    `);

    return NextResponse.json({
      success: true,
      data: {
        totals: {
          users: parseInt(totalUsers.rows[0].cnt, 10),
          staff: parseInt(totalStaff.rows[0].cnt, 10),
          roles: parseInt(totalRoles.rows[0].cnt, 10),
          staffRoles: parseInt(staffRolesCount.rows[0].cnt, 10),
        },
        users: {
          linked: parseInt(linkedUsers.rows[0].cnt, 10),
          orphan: parseInt(orphanUsers.rows[0].cnt, 10),
          active: parseInt(activeUsers.rows[0].cnt, 10),
          pending: parseInt(pendingUsers.rows[0].cnt, 10),
        },
        staff: {
          withoutUser: parseInt(staffWithoutUser.rows[0].cnt, 10),
          withoutRole: parseInt(staffWithoutRole.rows[0].cnt, 10),
        },
        integrity: {
          healthy: parseInt(orphanUsers.rows[0].cnt, 10) === 0 &&
                   parseInt(staffWithoutUser.rows[0].cnt, 10) === 0 &&
                   parseInt(staffWithoutRole.rows[0].cnt, 10) === 0,
        },
        orphanUsers: orphanList.rows,
        staffWithoutUser: staffNoUserList.rows,
        staffWithoutRole: staffNoRoleList.rows,
      },
    });
  } catch (error) {
    console.error('[debug] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load debug data' }, { status: 500 });
  }
}
