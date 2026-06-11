import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUserOrThrow } from '@/lib/current-user';

/**
 * GET /api/communication/users — Get users available for conversation
 * Filters by staff list, role, hierarchy. Searchable.
 * NO manual username typing — only selectable from this list.
 */
export async function GET(request) {
  try {
    const currentUser = await getCurrentUserOrThrow();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role');
    const department = searchParams.get('department');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    let sql = `
      SELECT 
        u.id, u.email, COALESCE(u.full_name, u.name) as full_name, u.role, u.status,
        u.profile_image_url, u.avatar_id, u.department, u.hierarchy_level,
        s.id as staff_id, s.name as staff_name
      FROM users u
      LEFT JOIN staff s ON s.user_id = u.id
      WHERE u.id != $1 AND u.status = 'active'
    `;
    const params = [currentUser.id];
    let paramIdx = 2;

    if (search) {
      sql += ` AND (u.full_name ILIKE $${paramIdx} OR u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR s.name ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (role) {
      sql += ` AND u.role = $${paramIdx}`;
      params.push(role);
      paramIdx++;
    }

    if (department) {
      sql += ` AND u.department = $${paramIdx}`;
      params.push(department);
      paramIdx++;
    }

    // Hierarchy filter: users at same level or below (unless superadmin)
    if (currentUser.role !== 'superadmin') {
      sql += ` AND (u.hierarchy_level IS NULL OR u.hierarchy_level >= $${paramIdx})`;
      // Get current user's hierarchy level
      const userResult = await query('SELECT hierarchy_level FROM users WHERE id = $1', [currentUser.id]);
      params.push(userResult.rows[0]?.hierarchy_level || 0);
      paramIdx++;
    }

    sql += ` ORDER BY u.full_name ASC LIMIT $${paramIdx}`;
    params.push(limit);

    const result = await query(sql, params);

    // Also get roles and departments for filter dropdowns
    const rolesResult = await query(
      "SELECT DISTINCT role FROM users WHERE status = 'active' ORDER BY role"
    );
    const deptResult = await query(
      "SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department != '' ORDER BY department"
    );

    return NextResponse.json({
      success: true,
      data: result.rows.map(u => ({
        ...u,
        avatar_url: u.profile_image_url
          || (u.avatar_id ? `https://api.dicebear.com/9.x/${u.avatar_id.split('-')[0]}/svg?seed=${u.avatar_id.split('-').slice(1).join('-')}&size=64` : null)
          || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(u.full_name || u.email)}&size=64`,
      })),
      filters: {
        roles: rolesResult.rows.map(r => r.role),
        departments: deptResult.rows.map(d => d.department),
      },
    });
  } catch (err) {
    if (err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Communication users fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
