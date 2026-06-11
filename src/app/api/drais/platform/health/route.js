import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { get, configuredness, DraisPlatformError } from '@/lib/drais-platform.js';

// GET /api/drais/platform/health
// Internal proxy: pings the DRAIS Platform v1 /health and returns the result.
// Auth: admin-side observability — requires the same audit.view perm we use
// elsewhere for cross-system health surfaces.
export async function GET(request) {
  const perm = await requirePermission(request, 'audit.view');
  if (perm instanceof NextResponse) return perm;

  const cfg = configuredness();
  if (!cfg.base_url_set || !cfg.token_set) {
    return NextResponse.json({
      success: false,
      error: 'DRAIS Platform credentials not configured',
      configured: cfg,
    }, { status: 503 });
  }

  try {
    const r = await get('/health');
    return NextResponse.json({
      success: true,
      data: r.data,
      meta: {
        request_id: r.requestId,
        api_version: r.apiVersion,
        latency_ms: r.latencyMs,
        rate_limit: r.rateLimit,
      },
    });
  } catch (err) {
    const e = err instanceof DraisPlatformError ? err : { code: 'INTERNAL', message: err.message };
    return NextResponse.json({
      success: false,
      error: e.message || 'DRAIS health check failed',
      code: e.code,
      status: e.status,
      request_id: e.requestId,
    }, { status: 502 });
  }
}
