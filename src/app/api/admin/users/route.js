import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission, getUserAuthorityLevel, buildAuthorityFilter } from '@/lib/permissions.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'users.view');
  if (perm instanceof NextResponse) return perm;
  try {
    const { auth } = perm;

    // Hierarchy filter: viewer only sees users whose authority_level <= their own
    // Superadmin always gets authority 100 (bypasses filter entirely via 1=1).
    const viewerAuthority = auth.role === 'superadmin' ? 100 : await getUserAuthorityLevel(auth.userId);
    const { clause, params } = buildAuthorityFilter(viewerAuthority, {
      actorAuthorityCol: 'u.authority_level',
      startIdx: 1,
    });

    const result = await query(
      `SELECT u.id, u.email, u.username, u.name, u.role, u.status, u.is_active,
              u.authority_level, u.first_login_completed, u.must_reset_password,
              u.last_login, u.created_at, u.staff_id,
              s.name  AS staff_name,
              s.email AS staff_email,
              r.name  AS role_name,
              r.hierarchy_level,
              r.authority_level AS role_authority_level
         FROM users u
         LEFT JOIN staff  s ON u.staff_id = s.id
         LEFT JOIN roles  r ON u.role = r.name
        WHERE ${clause}
        ORDER BY u.created_at DESC`,
      params
    );

    // Safety valve: never silently return empty when records exist but were
    // filtered by authority. Surface a clear message instead.
    if (result.rows.length === 0 && viewerAuthority < 100) {
      const total = await query('SELECT COUNT(*) AS cnt FROM users');
      if (parseInt(total.rows[0].cnt, 10) > 0) {
        return NextResponse.json({
          success: true,
          data: [],
          restricted: true,
          message: 'Access restricted to higher authority users',
        });
      }
    }

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[admin/users] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
  }
}
