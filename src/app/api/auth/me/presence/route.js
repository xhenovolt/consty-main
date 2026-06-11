import { Pool } from 'pg';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * POST /api/auth/me/presence
 * Update current user's presence (last_seen_at)
 */
export async function POST(req) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { route, page_title, device_info } = await req.json();
    
    // Update last_seen_at and online_status
    const statusResult = await pool.query(
      `SELECT calculate_online_status($1) as status`,
      [auth.userId]
    );
    
    const onlineStatus = statusResult.rows[0]?.status || 'offline';
    
    // Update users table
    const result = await pool.query(
      `UPDATE users 
       SET last_seen_at = CURRENT_TIMESTAMP,
           online_status = $2
       WHERE id = $1`,
      [auth.userId, onlineStatus]
    );
    
    // Also update user_presence if it exists
    await pool.query(
      `INSERT INTO user_presence (user_id, last_ping, status, current_route, current_page_title, device_info, updated_at)
       VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE
       SET last_ping = CURRENT_TIMESTAMP,
           status = EXCLUDED.status,
           current_route = COALESCE($3, user_presence.current_route),
           current_page_title = COALESCE($4, user_presence.current_page_title),
           device_info = COALESCE($5, user_presence.device_info),
           updated_at = CURRENT_TIMESTAMP`,
      [auth.userId, onlineStatus, route, page_title, device_info]
    );
    
    return NextResponse.json({
      success: true,
      online_status: onlineStatus,
      last_seen_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating presence:', error);
    return NextResponse.json(
      { error: 'Failed to update presence' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/me/presence
 * Get current user's presence status
 */
export async function GET(req) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const result = await pool.query(
      `SELECT last_seen_at, online_status FROM users WHERE id = $1`,
      [auth.userId]
    );
    
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      last_seen_at: result.rows[0].last_seen_at,
      online_status: result.rows[0].online_status
    });
  } catch (error) {
    console.error('Error fetching presence:', error);
    return NextResponse.json(
      { error: 'Failed to fetch presence' },
      { status: 500 }
    );
  }
}
