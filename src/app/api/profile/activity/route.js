import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUserOrThrow } from '@/lib/current-user';

/**
 * GET /api/profile/activity — Fetch user activity timeline
 */
export async function GET(request) {
  try {
    const user = await getCurrentUserOrThrow();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await query(
      `SELECT id, action, entity_type, entity_id, details, ip_address, created_at
       FROM user_activity_log
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as total FROM user_activity_log WHERE user_id = $1',
      [user.id]
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0]?.total || 0),
      limit,
      offset,
    });
  } catch (err) {
    if (err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
