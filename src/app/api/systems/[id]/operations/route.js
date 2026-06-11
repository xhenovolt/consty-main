import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

const VALID_TYPES = ['development', 'bug_fix', 'testing', 'deployment', 'architecture_change', 'maintenance', 'update', 'other'];

// GET /api/systems/[id]/operations
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const result = await query(
      `SELECT * FROM system_operations WHERE system_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[SystemOps] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch system operations' }, { status: 500 });
  }
}

// POST /api/systems/[id]/operations
export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const body = await request.json();
    const { operation_type, description, status } = body;

    if (!description?.trim()) {
      return NextResponse.json({ success: false, error: 'description is required' }, { status: 400 });
    }
    if (!VALID_TYPES.includes(operation_type)) {
      return NextResponse.json({ success: false, error: `operation_type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO system_operations (system_id, operation_type, description, status, completed_at)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, operation_type, description, status || 'completed',
       (status === 'completed' || !status) ? new Date().toISOString() : null]
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[SystemOps] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create system operation' }, { status: 500 });
  }
}
