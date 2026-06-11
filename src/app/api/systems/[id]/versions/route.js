import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { Events } from '@/lib/events.js';

/**
 * GET /api/systems/[id]/versions
 * Fetch versions for a system
 */
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.view');
    if (perm instanceof NextResponse) return perm;

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Count total
    const countResult = await query(
      'SELECT COUNT(*) as count FROM system_versions WHERE system_id = $1',
      [id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT 
        sv.*,
        u.full_name as released_by_name
      FROM system_versions sv
      LEFT JOIN users u ON u.id = sv.released_by
      WHERE sv.system_id = $1
      ORDER BY sv.released_at DESC NULLS LAST, sv.created_at DESC
      LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

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
    console.error('[System Versions] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch versions' }, { status: 500 });
  }
}

/**
 * POST /api/systems/[id]/versions
 * Create a new version record
 */
export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.edit');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = params;
    const { version_name, version_number, release_notes, changelog, has_breaking_changes, migration_notes } = await request.json();

    if (!version_name || !version_number) {
      return NextResponse.json(
        { success: false, error: 'version_name and version_number are required' },
        { status: 400 }
      );
    }

    // Validate system exists
    const systemCheck = await query('SELECT id FROM systems WHERE id = $1', [id]);
    if (!systemCheck.rows[0]) {
      return NextResponse.json({ success: false, error: 'System not found' }, { status: 404 });
    }

    const result = await query(
      `INSERT INTO system_versions
       (system_id, version_name, version_number, release_notes, changelog, has_breaking_changes, migration_notes, released_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, version_name, version_number, release_notes || null, changelog || {}, has_breaking_changes || false, migration_notes || null, auth.userId]
    );

    // Update system
    await query(
      'UPDATE systems SET version = $1, last_intelligence_update = NOW() WHERE id = $2',
      [version_number, id]
    );

    // Log event
    Events.log('version.created', {
      userId: auth.userId,
      systemId: id,
      versionNumber: version_number,
    });

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[System Versions] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create version' }, { status: 500 });
  }
}
