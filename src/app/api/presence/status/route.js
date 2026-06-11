/**
 * GET /api/presence/status?userId=<uuid>   → single user status
 * GET /api/presence/status                 → all online users (admin only)
 *
 * Status logic (source of truth = last_ping):
 *   online:  NOW() - last_ping < 60 seconds
 *   away:    NOW() - last_ping between 60s and 5 minutes
 *   offline: NOW() - last_ping > 5 minutes
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/current-user';
import { query } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-utils.js';

export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      // Single user lookup
      const { rows } = await query(
        `SELECT
           user_id,
           last_ping,
           last_seen,
           current_route,
           current_page_title,
           CASE
             WHEN NOW() - last_ping < INTERVAL '60 seconds' THEN 'online'
             WHEN NOW() - last_ping < INTERVAL '5 minutes'  THEN 'away'
             ELSE 'offline'
           END AS status
         FROM user_presence
         WHERE user_id = $1`,
        [userId]
      );

      if (!rows.length) {
        return NextResponse.json({ status: 'offline', last_seen: null });
      }

      return NextResponse.json(rows[0]);
    }

    // All users – only admins can see this
    if (!user.is_superadmin && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { rows } = await query(
      `SELECT
         up.user_id,
         u.name,
         u.email,
         up.last_ping,
         up.last_seen,
         up.current_route,
         up.current_page_title,
         CASE
           WHEN NOW() - up.last_ping < INTERVAL '60 seconds' THEN 'online'
           WHEN NOW() - up.last_ping < INTERVAL '5 minutes'  THEN 'away'
           ELSE 'offline'
         END AS status
       FROM user_presence up
       JOIN users u ON u.id = up.user_id
       ORDER BY up.last_ping DESC
       LIMIT 100`
    );

    return NextResponse.json({ users: rows });
  } catch (err) {
    console.error('[presence/status]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
