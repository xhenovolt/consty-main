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
    const entity_type = searchParams.get('entity_type');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let sql = `SELECT al.*, u.email as user_email, u.name as user_name
               FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE 1=1`;
    const params = [];
    if (action) { params.push(action); sql += ` AND al.action = $${params.length}`; }
    if (entity_type) { params.push(entity_type); sql += ` AND al.entity_type = $${params.length}`; }
    sql += ` ORDER BY al.created_at DESC`;
    params.push(limit); sql += ` LIMIT $${params.length}`;
    params.push(offset); sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
