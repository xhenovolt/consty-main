/**
 * Middleware - Edge Runtime Safe
 *
 * PURE EDGE LOGIC ONLY:
 * - Reads cookies
 * - Validates session existence (cookie presence only — no DB access possible)
 * - Redirects unauthenticated users away from protected routes
 * - NO database access, NO crypto, NO Node-only APIs
 *
 * ─── IMPORTANT: loop-prevention rule ────────────────────────────────────────
 * The middleware MUST NOT redirect *away* from /login based on cookie presence
 * alone. The cookie may reference a session that has already expired in the DB.
 * If we redirect from /login → /app/dashboard and the app layout then finds an
 * invalid session and redirects back → /login, we get an infinite 307 loop.
 *
 * Auth-only routes (/login, /register) are therefore always allowed through.
 * "Already logged in" redirect is handled client-side in LoginForm after it
 * confirms the session is genuinely valid via /api/auth/me.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require a session cookie to access
const PROTECTED_PREFIXES = [
  '/app',
  '/setup-password',
];

// Route for forced first-login password reset
const SETUP_PASSWORD_ROUTE = '/setup-password';

/**
 * Extract session ID from cookie — edge-safe, no verification
 */
function getSessionCookie(request: NextRequest): string | null {
  return request.cookies.get('consty_session')?.value ?? null;
}

/**
 * Check if user has a pending password reset cookie
 */
function hasMustResetCookie(request: NextRequest): boolean {
  return request.cookies.get('consty_must_reset')?.value === '1';
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = !!getSessionCookie(request);

  // ── DEBUG HEADER (visible in Vercel function logs) ───────────────────────
  const debugInfo = `path=${pathname} hasCookie=${hasSessionCookie}`;

  // ── SETUP-PASSWORD GUARD ─────────────────────────────────────────────────
  // If the user has `consty_must_reset=1`, force them to /setup-password first.
  // Allow /api routes regardless.
  if (hasSessionCookie && hasMustResetCookie(request)) {
    if (!pathname.startsWith(SETUP_PASSWORD_ROUTE) && !pathname.startsWith('/api')) {
      console.info(`[Middleware] must-reset guard → ${SETUP_PASSWORD_ROUTE} (${debugInfo})`);
      return NextResponse.redirect(new URL(SETUP_PASSWORD_ROUTE, request.url));
    }
    return NextResponse.next();
  }

  // ── PROTECTED ROUTES ─────────────────────────────────────────────────────
  // Only gate on cookie PRESENCE. Full session validation happens in the
  // server component layout (getCurrentUser) and in API route handlers.
  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));
  if (isProtected && !hasSessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    console.info(`[Middleware] no cookie → /login (${debugInfo})`);
    return NextResponse.redirect(loginUrl);
  }

  // ── AUTH ROUTES: ALWAYS ALLOW THROUGH ───────────────────────────────────
  // /login and /register are intentionally NOT redirected away even when a
  // session cookie is present. The cookie may be stale/expired in the DB.
  // LoginForm handles the "already logged in" redirect client-side by calling
  // /api/auth/me first — this is the only safe way without DB access in edge.

  // ── EVERYTHING ELSE ──────────────────────────────────────────────────────
  return NextResponse.next();
}

/**
 * Matcher: run middleware on all page routes except static assets & API routes
 * API routes do their own auth inside the route handlers.
 */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
