import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { Events } from '@/lib/events.js';

/**
 * GET /api/systems/[id]/architecture
 * Fetch system architecture
 */
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.view');
    if (perm instanceof NextResponse) return perm;

    const { id } = params;

    const result = await query(
      `SELECT * FROM system_architecture WHERE system_id = $1`,
      [id]
    );

    // If doesn't exist, return empty structure
    if (!result.rows[0]) {
      return NextResponse.json({
        success: true,
        data: {
          system_id: id,
          tech_stack: {},
          platforms: [],
        },
      });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[System Architecture] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch architecture' }, { status: 500 });
  }
}

/**
 * POST/PUT /api/systems/[id]/architecture
 * Create or update system architecture
 */
export async function POST(request, { params }) {
  return updateArchitecture(request, params);
}

export async function PUT(request, { params }) {
  return updateArchitecture(request, params);
}

async function updateArchitecture(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.edit');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = params;
    const body = await request.json();

    // Validate system exists
    const systemCheck = await query('SELECT id FROM systems WHERE id = $1', [id]);
    if (!systemCheck.rows[0]) {
      return NextResponse.json({ success: false, error: 'System not found' }, { status: 404 });
    }

    // Check if architecture entry exists
    const existing = await query(
      'SELECT id FROM system_architecture WHERE system_id = $1',
      [id]
    );

    const result = existing.rows[0]
      ? await query(
          `UPDATE system_architecture
           SET tech_stack = $1, platforms = $2, database_type = $3, database_version = $4, 
               hosting_environment = $5, deployment_url = $6, architecture_pattern = $7,
               authentication_method = $8, database_architecture = $9, updated_by = $10, updated_at = NOW()
           WHERE system_id = $11
           RETURNING *`,
          [
            body.tech_stack || {},
            body.platforms || [],
            body.database_type || null,
            body.database_version || null,
            body.hosting_environment || null,
            body.deployment_url || null,
            body.architecture_pattern || null,
            body.authentication_method || null,
            body.database_architecture || null,
            auth.userId,
            id,
          ]
        )
      : await query(
          `INSERT INTO system_architecture
           (system_id, tech_stack, platforms, database_type, database_version, hosting_environment, 
            deployment_url, architecture_pattern, authentication_method, database_architecture, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            id,
            body.tech_stack || {},
            body.platforms || [],
            body.database_type || null,
            body.database_version || null,
            body.hosting_environment || null,
            body.deployment_url || null,
            body.architecture_pattern || null,
            body.authentication_method || null,
            body.database_architecture || null,
            auth.userId,
          ]
        );

    // Update system
    await query(
      'UPDATE systems SET last_intelligence_update = NOW() WHERE id = $1',
      [id]
    );

    // Log event
    Events.log('architecture.updated', {
      userId: auth.userId,
      systemId: id,
    });

    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: existing.rows[0] ? 200 : 201 }
    );
  } catch (error) {
    console.error('[System Architecture] POST/PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update architecture' }, { status: 500 });
  }
}
