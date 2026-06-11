import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/notifications — List notifications for current user
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));
    const unread_only = searchParams.get('unread') === 'true';
    const offset = (page - 1) * limit;

    let where = `WHERE n.recipient_user_id = $1`;
    const params = [auth.userId];

    if (unread_only) {
      where += ` AND n.is_read = false`;
    }

    const [rows, countResult, unreadResult] = await Promise.all([
      query(
        `SELECT n.*, u.name as actor_name
         FROM notifications n
         LEFT JOIN users u ON n.actor_user_id = u.id
         ${where}
         ORDER BY n.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) as total FROM notifications n ${where}`, params),
      query(`SELECT COUNT(*) as total FROM notifications WHERE recipient_user_id = $1 AND is_read = false`, [auth.userId]),
    ]);

    const total = parseInt(countResult.rows[0]?.total || 0);

    return NextResponse.json({
      success: true,
      data: rows.rows,
      unread_count: parseInt(unreadResult.rows[0]?.total || 0),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[Notifications] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// PATCH /api/notifications — Mark notifications as read
export async function PATCH(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { ids, mark_all } = body;

    if (mark_all) {
      await query(
        `UPDATE notifications SET is_read = true, read_at = NOW() WHERE recipient_user_id = $1 AND is_read = false`,
        [auth.userId]
      );
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ');
      await query(
        `UPDATE notifications SET is_read = true, read_at = NOW() WHERE recipient_user_id = $1 AND id IN (${placeholders})`,
        [auth.userId, ...ids]
      );
    } else {
      return NextResponse.json({ success: false, error: 'Provide ids array or mark_all: true' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Notifications] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update notifications' }, { status: 500 });
  }
}
