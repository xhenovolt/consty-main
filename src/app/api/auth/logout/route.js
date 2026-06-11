/**
 * POST /api/auth/logout
 * Delete session and clear HTTP-only cookie
 */

import { NextResponse } from 'next/server.js';
import { cookies } from 'next/headers.js';
import { logAuthEvent, extractRequestMetadata } from '@/lib/audit.js';
import { getSession, deleteSession } from '@/lib/session.js';
import { query } from '@/lib/db.js';

export async function POST(request) {
  try {
    const requestMetadata = extractRequestMetadata(request);

    // Get session from cookie
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('consty_session')?.value;
    let userId = null;

    if (sessionId) {
      // Get session to log the correct user
      const session = await getSession(sessionId);
      if (session) {
        userId = session.userId;

        // Delete session from database
        await deleteSession(sessionId);

        // Mark user as offline in presence table
        try {
          await query(
            `UPDATE user_presence
             SET is_online   = false,
                 status      = 'offline',
                 updated_at  = NOW()
             WHERE user_id = $1`,
            [userId]
          );
          await query(
            `UPDATE users
             SET is_online  = false,
                 session_id = NULL
             WHERE id = $1`,
            [userId]
          );
        } catch (presenceErr) {
          // Non-fatal — presence columns may not exist yet
          console.warn('[logout] presence update failed:', presenceErr.message);
        }

        // Log logout event
        await logAuthEvent({
          action: 'LOGOUT',
          userId,
          requestMetadata,
        });
      }
    }

    // Create response and clear cookie
    const response = NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    );

    // Clear the session cookie
    response.cookies.set('consty_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
