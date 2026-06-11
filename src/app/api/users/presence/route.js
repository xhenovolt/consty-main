/**
 * GET /api/users/presence
 * Returns presence status for all users.
 * Computes status from last_ping:
 *   < 60s  → online
 *   < 5min → away
 *   else   → offline
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const result = await query(`
      SELECT
        up.user_id,
        u.email,
        u.name,
        up.last_seen,
        up.last_ping,
        up.device_info,
        CASE
          WHEN up.last_ping > NOW() - INTERVAL '60 seconds' THEN 'online'
          WHEN up.last_ping > NOW() - INTERVAL '5 minutes' THEN 'away'
          ELSE 'offline'
        END AS status
      FROM user_presence up
      JOIN users u ON up.user_id = u.id
      ORDER BY up.last_ping DESC
    `);

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Users/Presence] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch presence data' }, { status: 500 });
  }
}
