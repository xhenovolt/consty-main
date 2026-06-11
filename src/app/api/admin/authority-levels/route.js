/**
 * GET /api/admin/authority-levels - List all authority levels
 * POST /api/admin/authority-levels - Create new authority level
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const result = await query(
      `SELECT * FROM authority_levels WHERE is_active = true ORDER BY rank_value DESC`
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to fetch authority levels:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch authority levels' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'roles.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { name, description, rank_value, color_indicator } = await request.json();
    if (!name || rank_value === undefined) {
      return NextResponse.json({ success: false, error: 'name and rank_value are required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO authority_levels (name, description, rank_value, color_indicator, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), description || null, parseInt(rank_value), color_indicator || '#3b82f6', auth.userId]
    );

    await query(
      `INSERT INTO org_change_logs (changed_by, change_type, entity_type, entity_id, new_structure, description)
       VALUES ($1, 'created', 'authority_level', $2, $3, $4)`,
      [auth.userId, result.rows[0].id, JSON.stringify(result.rows[0]), `Authority level "${name}" created`]
    );

    dispatch('authority_level_created', {
      entityType: 'authority_level', entityId: result.rows[0].id,
      description: `Authority level "${name}" created (rank ${rank_value})`,
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'Authority level name already exists' }, { status: 409 });
    }
    console.error('Failed to create authority level:', error);
    return NextResponse.json({ success: false, error: 'Failed to create authority level' }, { status: 500 });
  }
}
