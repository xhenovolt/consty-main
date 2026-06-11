/**
 * GET  /api/system-logs          — list system logs (admin/superadmin only)
 * DELETE /api/system-logs?before — purge old logs (superadmin only)
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { verifyAuth } from '@/lib/auth-utils.js';

export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (!auth.is_superadmin && auth.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const level   = searchParams.get('level');
    const module  = searchParams.get('module');
    const limit   = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

    let sql = `
      SELECT sl.*, u.name as user_name, u.email as user_email
      FROM system_logs sl
      LEFT JOIN users u ON sl.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (level)  { params.push(level);  sql += ` AND sl.level = $${params.length}`; }
    if (module) { params.push(module); sql += ` AND sl.module = $${params.length}`; }
    params.push(limit);
    sql += ` ORDER BY sl.created_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[system-logs] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch system logs' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || !auth.is_superadmin) {
      return NextResponse.json({ error: 'Forbidden — superadmin only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const before = searchParams.get('before'); // ISO date string

    if (!before) {
      return NextResponse.json({ error: 'before query param is required (ISO date)' }, { status: 400 });
    }

    const result = await query(
      `DELETE FROM system_logs WHERE created_at < $1`,
      [before]
    );

    return NextResponse.json({ success: true, deleted: result.rowCount });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to purge logs' }, { status: 500 });
  }
}
