import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

/**
 * GET /api/roles/search?q=eng&department_id=...
 * Dynamic typeahead search for roles — used in staff assignment, modals, etc.
 */
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const department_id = searchParams.get('department_id');
    const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 100);

    let sql = `
      SELECT r.id, r.name, r.description, r.hierarchy_level, r.alias, r.department_id,
             d.name AS department_name
      FROM roles r
      LEFT JOIN departments d ON r.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (q.trim()) {
      params.push(`%${q.trim()}%`);
      sql += ` AND (r.name ILIKE $${params.length} OR r.description ILIKE $${params.length} OR r.alias ILIKE $${params.length})`;
    }
    if (department_id) {
      params.push(department_id);
      sql += ` AND r.department_id = $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY r.hierarchy_level ASC, r.name ASC LIMIT $${params.length}`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Roles Search] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to search roles' }, { status: 500 });
  }
}
