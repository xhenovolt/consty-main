/**
 * POST /api/auth/register — DISABLED
 *
 * Public self-registration is not permitted in Consty.
 * User accounts are created exclusively by a superadmin through the
 * staff creation flow at POST /api/staff (with account details).
 */

import { NextResponse } from 'next/server.js';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Public registration is disabled.',
      message:
        'Consty is an internal system. User accounts are created by a system administrator. ' +
        'Contact your administrator to request access.',
    },
    { status: 410 }
  );
}

// ─── DISABLED ORIGINAL LOGIC (preserved for reference) ────────────────────
async function _disabledRegisterLogic(request) {
  // eslint-disable-next-line no-unreachable
  const { validateRegister } = await import('@/lib/validation.js');
  const { createUser, findUserByEmail, hashPassword, getUserCount } = await import('@/lib/auth.js');
  const { logAuthEvent, extractRequestMetadata } = await import('@/lib/audit.js');
  const { createSession, getSecureCookieOptions } = await import('@/lib/session.js');

  const body_disabled = request;
  try {
    const body = await request.json();

    // Validate input
    const validation = validateRegister(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          fields: validation.errors,
        },
        { status: 400 }
      );
    }

    const { email, password, name } = validation.data;
    const requestMetadata = extractRequestMetadata(request);

    // Check if email already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      await logAuthEvent({
        action: 'REGISTER_DUPLICATE',
        email,
        reason: 'Email already exists',
        requestMetadata,
      });

      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // SUPERADMIN BOOTSTRAP: First user = superadmin (active), rest = pending
    const userCount = await getUserCount();
    const isFirstUser = userCount === 0;

    const role = isFirstUser ? 'superadmin' : 'user';
    const status = isFirstUser ? 'active' : 'pending';

    // Create user
    const user = await createUser({
      email,
      passwordHash,
      name,
      role,
      isActive: true,
      status,
    });

    if (!user || user.error) {
      await logAuthEvent({
        action: 'REGISTER_FAILED',
        email,
        reason: user?.error || 'Unknown error',
        requestMetadata,
      });

      return NextResponse.json(
        { error: user?.error || 'Failed to create user' },
        { status: 500 }
      );
    }

    // Log success
    await logAuthEvent({
      action: isFirstUser ? 'SUPERADMIN_BOOTSTRAP' : 'REGISTER_SUCCESS',
      userId: user.id,
      email: user.email,
      requestMetadata,
    });

    // If first user (superadmin), create session and log them in immediately
    if (isFirstUser) {
      const sessionId = await createSession(user.id);

      const response = NextResponse.json(
        {
          message: 'Welcome! You are now the system superadmin.',
          userId: user.id,
          role: 'superadmin',
          status: 'active',
        },
        { status: 201 }
      );

      const cookieOptions = getSecureCookieOptions();
      response.cookies.set('consty_session', sessionId, cookieOptions);
      return response;
    }

    // For non-first users, respond with pending message (no session)
    return NextResponse.json(
      {
        message: 'Account created successfully. Your account is pending admin activation.',
        userId: user.id,
        status: 'pending',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
