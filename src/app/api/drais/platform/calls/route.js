import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/drais/platform/calls?limit=100
// Returns the observability log: recent DRAIS platform calls + aggregate
// stats. Sized for the health page; not paginated yet (defer until we
// have enough data to justify the UX).
export async function GET(request) {
  const perm = await requirePermission(request, 'audit.view');
  if (perm instanceof NextResponse) return perm;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500);

  try {
    const [recent, stats, byEndpoint, byError] = await Promise.all([
      query(
        `SELECT id, request_id, method, endpoint, status_code, latency_ms,
                response_size, error_code, attempt, idempotency_key, called_at
         FROM drais_api_calls
         ORDER BY called_at DESC
         LIMIT $1`,
        [limit]
      ),
      query(`
        SELECT
          COUNT(*)::int                                                   AS total,
          COUNT(*) FILTER (WHERE status_code BETWEEN 200 AND 299)::int    AS ok,
          COUNT(*) FILTER (WHERE status_code BETWEEN 400 AND 499)::int    AS client_err,
          COUNT(*) FILTER (WHERE status_code BETWEEN 500 AND 599)::int    AS server_err,
          COUNT(*) FILTER (WHERE error_code IN ('TIMEOUT','NETWORK'))::int AS network_err,
          PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY latency_ms)        AS p50,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)        AS p95,
          MAX(latency_ms)                                                 AS p_max
        FROM drais_api_calls
        WHERE called_at > NOW() - INTERVAL '24 hours'
      `),
      query(`
        SELECT endpoint, COUNT(*)::int AS n,
               PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY latency_ms) AS p50,
               PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
        FROM drais_api_calls
        WHERE called_at > NOW() - INTERVAL '24 hours'
        GROUP BY endpoint
        ORDER BY n DESC LIMIT 10
      `),
      query(`
        SELECT error_code, COUNT(*)::int AS n
        FROM drais_api_calls
        WHERE called_at > NOW() - INTERVAL '24 hours' AND error_code IS NOT NULL
        GROUP BY error_code
        ORDER BY n DESC LIMIT 10
      `),
    ]);

    return NextResponse.json({
      success: true,
      calls: recent.rows,
      stats: stats.rows[0],
      by_endpoint: byEndpoint.rows,
      by_error: byError.rows,
    });
  } catch (err) {
    console.error('[drais/platform/calls] GET error:', err);
    return NextResponse.json({ success: false, error: 'Failed to load call log' }, { status: 500 });
  }
}
