import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUserOrThrow } from '@/lib/current-user';

// GET /api/profile/sessions — current user's active + recent sessions.
// Surfaces device, ip, and last-active so users can audit their logins.
export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    const r = await query(
      `SELECT id, device_name, browser, os, ip_address, last_active_at, created_at, is_current
       FROM user_devices
       WHERE user_id = $1
       ORDER BY last_active_at DESC NULLS LAST, created_at DESC
       LIMIT 50`,
      [user.id]
    ).catch(() => ({ rows: [] }));

    // user_sessions is the truth for active logins; user_devices is the
    // human-readable history. Merge them so the UI can show both.
    const sessions = await query(
      `SELECT id, ip_address, user_agent, created_at, expires_at
       FROM user_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [user.id]
    ).catch(() => ({ rows: [] }));

    return NextResponse.json({
      success: true,
      devices: r.rows,
      sessions: sessions.rows,
    });
  } catch (err) {
    if (err.message === 'Not authenticated') return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    console.error('[profile.sessions]', err);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

// DELETE /api/profile/sessions?id=...  — revoke a session
export async function DELETE(request) {
  try {
    const user = await getCurrentUserOrThrow();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const r = await query(
      'DELETE FROM user_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, user.id]
    );
    if (!r.rows.length) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    await query(
      `INSERT INTO user_activity_log (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'session_revoked', 'user_session', $2, '{}')`,
      [user.id, id]
    ).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err.message === 'Not authenticated') return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    console.error('[profile.sessions DELETE]', err);
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
  }
}
