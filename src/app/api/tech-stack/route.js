import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/tech-stack — Get tech stack entries
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'systems.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const system_id = searchParams.get('system_id');

    let sql = `SELECT t.*, s.name as system_name FROM tech_stack_entries t LEFT JOIN systems s ON t.system_id = s.id WHERE 1=1`;
    const params = [];
    if (system_id) { params.push(system_id); sql += ` AND t.system_id = $${params.length}`; }
    sql += ` ORDER BY t.created_at DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch tech stack' }, { status: 500 });
  }
}

// POST /api/tech-stack — Add tech stack entry
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { system_id, language_or_framework, version, role_in_system } = body;
    if (!system_id || !language_or_framework) return NextResponse.json({ success: false, error: 'system_id and language_or_framework required' }, { status: 400 });

    const result = await query(
      `INSERT INTO tech_stack_entries (system_id, language_or_framework, version, role_in_system) VALUES ($1,$2,$3,$4) RETURNING *`,
      [system_id, language_or_framework, version || null, role_in_system || null]
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to add tech stack entry' }, { status: 500 });
  }
}

// DELETE /api/tech-stack — Remove entry
export async function DELETE(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    await query(`DELETE FROM tech_stack_entries WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
  }
}
