/**
 * Self-healing intelligence — server-side wrapper for API route handlers.
 *
 * Wrap an async route handler with `withSelfHealing` to automatically capture
 * unhandled errors as `issues` rows, attaching route, severity, and stack.
 *
 * Usage:
 *   export const POST = withSelfHealing('licenses.issue', async (req) => { ... });
 */

import { NextResponse } from 'next/server';
import { query } from './db.js';

function classifySeverity(err) {
  const msg = String(err?.message || '');
  if (/connection|ECONNREFUSED|timeout/i.test(msg)) return 'critical';
  if (/permission|forbidden|unauthor/i.test(msg)) return 'low';
  return 'medium';
}

export async function captureRouteError({ module: mod, route, error, request, userId }) {
  try {
    const severity = classifySeverity(error);
    const ip = request?.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() || null;
    await query(
      `INSERT INTO issues (title, description, severity, status, created_by)
       VALUES ($1, $2, $3, 'open', $4)`,
      [
        `[${mod}] ${error.message?.slice(0, 200) || 'Unknown error'}`,
        JSON.stringify({
          module: mod,
          route,
          stack: error.stack,
          ip,
          time: new Date().toISOString(),
        }, null, 2),
        severity,
        userId || null,
      ]
    );
  } catch (logErr) {
    console.error('[self-healing] failed to record issue:', logErr.message);
  }
}

export function withSelfHealing(moduleName, handler) {
  return async function wrapped(request, ctx) {
    try {
      return await handler(request, ctx);
    } catch (error) {
      const route = (() => { try { return new URL(request.url).pathname; } catch { return null; } })();
      console.error(`[${moduleName}] unhandled:`, error);
      await captureRouteError({ module: moduleName, route, error, request });
      return NextResponse.json(
        { success: false, error: 'An internal error occurred. The issue has been logged for investigation.' },
        { status: 500 }
      );
    }
  };
}
