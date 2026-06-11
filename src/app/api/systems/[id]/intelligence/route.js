import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';
import { Events } from '@/lib/events.js';

/**
 * GET /api/systems/[id]/intelligence
 * Fetch all intelligence entries for a system
 * Supports filtering by category, tags, and full-text search
 */
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const tags = searchParams.get('tags');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Validate system exists
    const systemCheck = await query('SELECT id FROM systems WHERE id = $1', [id]);
    if (!systemCheck.rows[0]) {
      return NextResponse.json({ success: false, error: 'System not found' }, { status: 404 });
    }

    let sql = `
      SELECT 
        si.*,
        u_created.full_name as created_by_name,
        u_updated.full_name as updated_by_name,
        (SELECT COUNT(*) FROM system_intelligence_internal_notes WHERE intelligence_id = si.id) as internal_notes_count,
        (SELECT COUNT(*) FROM system_intelligence WHERE parent_intelligence_id = si.id) as child_count
      FROM system_intelligence si
      LEFT JOIN users u_created ON si.created_by = u_created.id
      LEFT JOIN users u_updated ON si.updated_by = u_updated.id
      WHERE si.system_id = $1 AND (si.is_public = true OR si.created_by = $2 OR $3 = 'admin')
    `;
    const params = [id, auth.userId, auth.role];

    // Optional filters
    if (category) {
      params.push(category);
      sql += ` AND si.category = $${params.length}`;
    }

    if (tags) {
      const tagsArray = tags.split(',').map(t => t.trim());
      params.push(tagsArray);
      sql += ` AND si.tags && $${params.length}`;
    }

    if (search) {
      params.push(search);
      sql += ` AND (si.search_vector @@ plainto_tsquery('english', $${params.length}) OR si.title ILIKE '%' || $${params.length} || '%')`;
    }

    // Count total before pagination
    const countResult = await query(`SELECT COUNT(*) as count FROM (${sql}) as filtered_results`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Add pagination and ordering
    sql += ` ORDER BY si.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
    });
  } catch (error) {
    console.error('[System Intelligence] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch intelligence' }, { status: 500 });
  }
}

/**
 * POST /api/systems/[id]/intelligence
 * Create a new intelligence entry for a system
 */
export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.edit');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = params;
    const { title, category, content, summary, tags, version_tag, related_issue_id, related_module_id, parent_intelligence_id, is_public } = await request.json();

    // Validation
    if (!title || !category || !content) {
      return NextResponse.json(
        { success: false, error: 'title, category, and content are required' },
        { status: 400 }
      );
    }

    // Validate system exists
    const systemCheck = await query('SELECT id FROM systems WHERE id = $1', [id]);
    if (!systemCheck.rows[0]) {
      return NextResponse.json({ success: false, error: 'System not found' }, { status: 404 });
    }

    // Validate category
    const validCategories = [
      'architecture', 'feature', 'bug_fix', 'deployment', 'decision', 
      'integration', 'performance', 'security', 'scaling', 'api', 
      'database', 'infrastructure', 'guide', 'troubleshooting', 'release_notes'
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO system_intelligence
       (system_id, title, category, content, summary, tags, version_tag, related_issue_id, related_module_id, parent_intelligence_id, is_public, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [id, title, category, content, summary || null, tags || [], version_tag || null, related_issue_id || null, related_module_id || null, parent_intelligence_id || null, is_public || false, auth.userId]
    );

    // Update system intelligence metadata
    await query(
      `UPDATE systems 
       SET has_intelligence = true, last_intelligence_update = NOW(), intelligence_score = LEAST(100, intelligence_score + 5)
       WHERE id = $1`,
      [id]
    );

    // Log event
    Events.log('intelligence.created', {
      userId: auth.userId,
      systemId: id,
      intelligenceId: result.rows[0].id,
      category,
      title,
    });

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[System Intelligence] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create intelligence entry' }, { status: 500 });
  }
}
