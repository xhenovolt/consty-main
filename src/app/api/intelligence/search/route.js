import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * GET /api/intelligence/search
 * Global search across all system intelligence
 * Supports full-text search, filtering by system, category, tags
 */
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'systems.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const systemId = searchParams.get('system_id');
    const category = searchParams.get('category');
    const tags = searchParams.get('tags');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!q || q.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    let sql = `
      SELECT 
        si.id,
        si.system_id,
        s.name as system_name,
        si.title,
        si.category,
        si.summary,
        si.tags,
        si.created_at,
        u.full_name as created_by_name,
        ts_rank(si.search_vector, plainto_tsquery('english', $1)) as rank
      FROM system_intelligence si
      JOIN systems s ON s.id = si.system_id
      LEFT JOIN users u ON u.id = si.created_by
      WHERE (si.search_vector @@ plainto_tsquery('english', $1) OR si.title ILIKE '%' || $1 || '%')
        AND (si.is_public = true OR si.created_by = $2 OR $3 = 'admin')
    `;
    const params = [q, auth.userId, auth.role];

    // Optional filters
    if (systemId) {
      params.push(systemId);
      sql += ` AND si.system_id = $${params.length}`;
    }

    if (category) {
      params.push(category);
      sql += ` AND si.category = $${params.length}`;
    }

    if (tags) {
      const tagsArray = tags.split(',').map(t => t.trim());
      params.push(tagsArray);
      sql += ` AND si.tags && $${params.length}`;
    }

    // Count total
    const countResult = await query(`SELECT COUNT(*) as count FROM (${sql}) as search_results`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Add ordering and pagination
    sql += ` ORDER BY rank DESC, si.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      query: q,
    });
  } catch (error) {
    console.error('[Intelligence Search] GET error:', error);
    return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 });
  }
}
