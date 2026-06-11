import { NextResponse } from 'next/server.js';
import { validateLogin } from '@/lib/validation.js';
import { verifyCredentials, updateUserLastLogin } from '@/lib/auth.js';
import { logAuthEvent, extractRequestMetadata } from '@/lib/audit.js';
import { createSession, getSecureCookieOptions } from '@/lib/session.js';
import { query } from '@/lib/db.js';

/**
 * Parse user-agent string into { deviceName, browser, os }
 */
function parseUserAgent(ua = '') {
  // Browser detection (order matters — more specific first)
  let browser = 'Unknown';
  if (/Edg\//.test(ua))              browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua))   browser = 'Opera';
  else if (/Firefox\//.test(ua))     browser = 'Firefox';
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Browser';
  else if (/Chrome\//.test(ua))      browser = 'Chrome';
  else if (/Safari\//.test(ua))      browser = 'Safari';
  else if (/MSIE|Trident/.test(ua))  browser = 'Internet Explorer';

  // OS detection
  let os = 'Unknown';
  if (/Windows NT 10/.test(ua))      os = 'Windows 10';
  else if (/Windows NT 11/.test(ua)) os = 'Windows 11';
  else if (/Windows NT/.test(ua))    os = 'Windows';
  else if (/Android/.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/);
    os = m ? `Android ${m[1]}` : 'Android';
  }
  else if (/iPhone|iPad/.test(ua)) {
    const m = ua.match(/OS ([\d_]+)/);
    os = m ? `iOS ${m[1].replace(/_/g, '.')}` : 'iOS';
  }
  else if (/Macintosh/.test(ua))     os = 'macOS';
  else if (/Linux/.test(ua))         os = 'Linux';
  else if (/CrOS/.test(ua))         os = 'Chrome OS';

  // Device type
  let deviceName = 'Desktop';
  if (/Mobile|Android|iPhone/.test(ua))  deviceName = 'Mobile';
  else if (/Tablet|iPad/.test(ua))        deviceName = 'Tablet';

  return { deviceName, browser, os };
}

export async function POST(request) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateLogin(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          fields: validation.errors,
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;
    const requestMetadata = extractRequestMetadata(request);

    // Verify credentials
    const user = await verifyCredentials(email, password);

    // Handle status-based errors (pending, suspended, disabled)
    if (user && user.error) {
      await logAuthEvent({
        action: 'LOGIN_BLOCKED',
        email,
        reason: user.error,
        requestMetadata,
      });

      const statusMessages = {
        ACCOUNT_PENDING: 'Your account is pending admin activation.',
        ACCOUNT_SUSPENDED: 'Your account has been suspended.',
        ACCOUNT_DISABLED: 'Your account has been disabled.',
      };

      return NextResponse.json(
        { error: statusMessages[user.error] || user.message || 'Login failed', code: user.error },
        { status: 403 }
      );
    }

    if (!user) {
      // Log failed attempt
      await logAuthEvent({
        action: 'LOGIN_FAILURE',
        email,
        reason: 'Invalid credentials',
        requestMetadata,
      });

      // Generic error - don't reveal whether email exists
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Update last login
    await updateUserLastLogin(user.id);

    // Collect device metadata for session tracking
    const rawUA = request.headers.get('user-agent') || '';
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;
    const { deviceName, browser, os } = parseUserAgent(rawUA);
    const deviceInfo = {
      ipAddress,
      userAgent: rawUA || null,
      deviceName,
      browser,
      os,
    };

    // Create session in database
    const sessionId = await createSession(user.id, deviceInfo);

    // Update presence: mark user online immediately on login
    try {
      await query(
        `INSERT INTO user_presence (user_id, last_ping, last_seen, status, is_online, updated_at)
         VALUES ($1, NOW(), NOW(), 'online', true, NOW())
         ON CONFLICT (user_id) DO UPDATE
         SET last_ping  = NOW(),
             last_seen  = NOW(),
             status     = 'online',
             is_online  = true,
             updated_at = NOW()`,
        [user.id]
      );
      await query(
        `UPDATE users
         SET is_online    = true,
             last_seen    = NOW(),
             last_seen_at = NOW(),
             session_id   = $2
         WHERE id = $1`,
        [user.id, sessionId]
      );
    } catch (presenceErr) {
      console.warn('[login] presence update failed:', presenceErr.message);
    }

    // Log success
    await logAuthEvent({
      action: 'LOGIN_SUCCESS',
      userId: user.id,
      email: user.email,
      requestMetadata,
    });

    // Check if user must reset their temporary password on first login
    const mustReset = user.must_reset_password === true;

    // Create response
    const response = NextResponse.json(
      {
        message: mustReset ? 'Password reset required' : 'Logged in successfully',
        requirePasswordReset: mustReset,
      },
      { status: 200 }
    );

    // Set HTTP-only session cookie
    const cookieOptions = getSecureCookieOptions();
    response.cookies.set('consty_session', sessionId, cookieOptions);

    // Set a short-lived indicator cookie when password reset is required.
    // Middleware uses this to guard all app routes until reset is complete.
    if (mustReset) {
      response.cookies.set('consty_must_reset', '1', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        // Expires with the session
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
