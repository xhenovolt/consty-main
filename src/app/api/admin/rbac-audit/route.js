/**
 * GET /api/admin/rbac-audit - List RBAC audit log entries
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'audit.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    let sql = `
      SELECT ral.*, u.name AS user_name, u.email AS user_email
      FROM rbac_audit_logs ral
      LEFT JOIN users u ON ral.user_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (action) {
      conditions.push(`ral.action = $${params.length + 1}`);
      params.push(action);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ` ORDER BY ral.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to fetch RBAC audit logs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch RBAC audit logs' }, { status: 500 });
  }
}
