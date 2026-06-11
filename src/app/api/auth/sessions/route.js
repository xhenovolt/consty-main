/**
 * GET  /api/auth/sessions       – list active sessions for current user
 * DELETE /api/auth/sessions/:id – revoke a specific session (admin can revoke any)
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers.js';
import { getUserSessions, revokeSession, revokeAllUserSessionsExcept } from '@/lib/session.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/auth/sessions — list all active sessions for current user
export async function GET(request) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const sessions = await getUserSessions(auth.userId);

  // Get current session ID to mark it
  const cookieStore = await cookies();
  const currentSessionId = cookieStore.get('consty_session')?.value;

  const sessionsWithCurrent = sessions.map(s => ({
    ...s,
    is_current: s.id === currentSessionId,
  }));

  return NextResponse.json({ success: true, data: sessionsWithCurrent });
}

// DELETE /api/auth/sessions — revoke all other sessions (keep current)
export async function DELETE(request) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const cookieStore = await cookies();
  const currentSessionId = cookieStore.get('consty_session')?.value;

  const { sessionId } = await request.json().catch(() => ({}));

  if (sessionId) {
    // Revoke a specific session — only allowed if it belongs to the current user
    // (or the requester is superadmin)
    const ownerFilter = auth.is_superadmin ? null : auth.userId;
    const ok = await revokeSession(sessionId, ownerFilter);
    if (!ok) return NextResponse.json({ error: 'Session not found or not authorized' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Session revoked' });
  }

  // Revoke all sessions except the current active one
  const count = await revokeAllUserSessionsExcept(auth.userId, currentSessionId ?? undefined);
  return NextResponse.json({ success: true, message: `${count} session(s) revoked` });
}
