/**
 * GET /api/issues
 * Get all issues with filters
 */

import { getCurrentUser } from '@/lib/current-user.js';
import { query } from '@/lib/db.js';

export async function GET(req) {
  try {
    const user = await getCurrentUser();
    if (!user || !['superadmin', 'admin'].includes(user.role)) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const source = searchParams.get('source');
    const limit = parseInt(searchParams.get('limit')) || 100;
    const offset = parseInt(searchParams.get('offset')) || 0;
    
    let sql = `
      SELECT 
        id, system_id, title, description, severity, source, status,
        reported_by_user_id, assigned_to_user_id, error_code, created_at,
        resolved_at, updated_at
      FROM issues
      WHERE 1 = 1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    if (severity) {
      sql += ` AND severity = $${paramIndex++}`;
      params.push(severity);
    }
    if (source) {
      sql += ` AND source = $${paramIndex++}`;
      params.push(source);
    }
    
    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    
    const result = await query(sql, params);
    
    return Response.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('[issues GET] Error:', error.message);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
