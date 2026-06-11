/**
 * POST /api/auth/setup-password
 *
 * Called on first login when must_reset_password = true.
 * Validates the new password, updates the hash, clears the reset flag,
 * and deletes the consty_must_reset cookie so the user gains full access.
 *
 * Requires a valid consty_session cookie.
 */

import { NextResponse } from 'next/server.js';
import { cookies } from 'next/headers.js';
import { getSession } from '@/lib/session.js';
import { hashPassword } from '@/lib/auth.js';
import { query } from '@/lib/db.js';
import { logAuthEvent, extractRequestMetadata } from '@/lib/audit.js';

export async function POST(request) {
  try {
    const requestMetadata = extractRequestMetadata(request);

    // Verify session
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('consty_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 });
    }

    const userId = session.userId;

    // Confirm the user still has the reset flag set
    const userResult = await query(
      'SELECT id, must_reset_password, status FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (!user.must_reset_password) {
      // Already reset — just redirect normally
      return NextResponse.json({ message: 'Password already set. Please log in.' }, { status: 200 });
    }

    // Parse and validate new password
    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'newPassword is required' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }
    if (!/[A-Z]/.test(newPassword)) {
      return NextResponse.json(
        { error: 'Password must contain at least one uppercase letter.' },
        { status: 400 }
      );
    }
    if (!/[0-9]/.test(newPassword)) {
      return NextResponse.json(
        { error: 'Password must contain at least one number.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    // Update password and clear reset flag atomically; mark first login complete
    await query(
      `UPDATE users
       SET password_hash = $1,
           must_reset_password    = false,
           first_login_completed  = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [passwordHash, userId]
    );

    await logAuthEvent({
      action: 'PASSWORD_SETUP_COMPLETE',
      userId,
      requestMetadata,
    });

    // Remove the must-reset cookie
    const response = NextResponse.json({ message: 'Password updated successfully.' }, { status: 200 });
    response.cookies.set('consty_must_reset', '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('[setup-password] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
