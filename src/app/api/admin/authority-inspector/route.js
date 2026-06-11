/**
 * GET /api/admin/authority-inspector
 *
 * Returns every user with their resolved authority level, role(s), and staff link.
 * Used by the Authority Inspector admin page.
 * Requires: roles.manage permission (superadmin/admin only).
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'roles.manage');
  if (perm instanceof NextResponse) return perm;

  try {
    const result = await query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.username,
        u.role                    AS base_role,
        u.status,
        u.is_active,
        u.authority_level,
        u.first_login_completed,
        u.last_login,
        s.id                      AS staff_id,
        s.position,
        s.department,
        s.linked_user_id,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id',              r.id,
                'name',            r.name,
                'authority_level', r.authority_level,
                'hierarchy_level', r.hierarchy_level
              ) ORDER BY r.authority_level DESC
            )
            FROM staff_roles sr
            JOIN roles r ON sr.role_id = r.id
            WHERE sr.staff_id = s.id
          ),
          '[]'::json
        ) AS assigned_roles
      FROM users u
      LEFT JOIN staff s ON u.staff_id = s.id
      ORDER BY u.authority_level DESC NULLS LAST, u.name
    `);

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[authority-inspector] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch authority data' }, { status: 500 });
  }
}
