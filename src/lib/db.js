import pg from 'pg';
import * as env from './env.js';

const { Pool } = pg;

/**
 * PostgreSQL connection pool, tuned for Neon serverless.
 *
 * Why this is shaped the way it is:
 *
 * 1. Neon auto-pauses the compute when idle. Cold-starts take a few seconds.
 *    A pre-warm strategy (min: 1) fights that — the warm client gets
 *    silently killed when compute pauses, then the next caller picks it
 *    up and discovers it's dead 30s later. So min: 0, and we let Neon
 *    manage the lifecycle.
 *
 * 2. `keepAlive: true` keeps the TCP socket alive across intermediate
 *    NATs / proxies. Without it, sockets can hang in a half-closed state
 *    that pg.Pool doesn't notice until query time.
 *
 * 3. `connectionTimeoutMillis: 8000` — fail fast on a single attempt.
 *    Combined with at most one retry, the worst-case wall clock is
 *    ~12s instead of the previous ~33s.
 *
 * 4. Retry policy: ONLY retry on known transient errors
 *    (ECONNRESET / ETIMEDOUT / 57P01 admin_shutdown / "Connection terminated").
 *    Crucially, we do NOT retry "Connection terminated due to connection
 *    timeout" — that's the symptom of Neon compute being paused, and
 *    retrying just multiplies the wait. We fail fast and let the
 *    caller render an error or a degraded UI.
 *
 * 5. `query_timeout` / `statement_timeout` kill runaway queries at the
 *    server level. Set per-connection so they apply to every client.
 */

let pool = null;

const POOL_DEFAULTS = {
  max: 5,
  min: 0,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 8_000,
  maxUses: 7_500,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  query_timeout: 30_000,       // 30s max per client-side query
  statement_timeout: 30_000,   // 30s max as enforced by Postgres
};

/**
 * Thrown when the underlying database is unreachable / cold / paused.
 * Callers (auth, session lookup, API routes) can catch this specifically
 * and return 503 Service Unavailable instead of generic 500 / silent 401.
 */
export class DatabaseUnavailableError extends Error {
  constructor(cause) {
    super(cause?.message || 'Database unavailable');
    this.name = 'DatabaseUnavailableError';
    this.cause = cause;
    this.code = cause?.code || 'EDBDOWN';
  }
}

function initializePool() {
  if (pool) return pool;

  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const usesSsl = connectionString.includes('neon.tech') || connectionString.includes('sslmode=');

  pool = new Pool({
    connectionString,
    ...POOL_DEFAULTS,
    ssl: usesSsl ? { rejectUnauthorized: false } : false,
  });

  // On a fatal pool error (e.g. idle client died because compute paused),
  // tear down so the next request rebuilds against fresh sockets.
  pool.on('error', (err) => {
    console.warn('[db] pool error, dropping pool:', err.message);
    const dying = pool;
    pool = null;
    dying.end().catch(() => {});
  });

  return pool;
}

/**
 * Classify an error so we can decide whether to retry once or fail fast.
 *
 *   transient:  network glitch / admin shutdown — retry helps.
 *   timeout:    compute is paused / unreachable — retry just doubles the wait.
 *   query:      SQL-level error — don't retry, the caller's bug.
 */
function classifyError(err) {
  const msg = String(err?.message || '');
  const code = err?.code;

  // Postgres admin_shutdown / crash_shutdown / cannot_connect_now.
  if (code === '57P01' || code === '57P02' || code === '57P03') return 'transient';

  if (code === 'ECONNRESET' || code === 'EPIPE') return 'transient';
  if (msg.includes('Connection terminated unexpectedly')) return 'transient';

  // Cold-start / fully-paused compute — retrying inside the same request
  // window almost never helps. Fail fast.
  if (code === 'ETIMEDOUT' || code === 'ENETUNREACH') return 'timeout';
  if (msg.includes('connection timeout')) return 'timeout';
  if (msg.includes('timeout expired')) return 'timeout';
  if (msg.includes('Connection terminated due to connection timeout')) return 'timeout';

  return 'query';
}

/**
 * Run a single SQL statement against the pool, with at most one retry on
 * transient errors. Throws DatabaseUnavailableError for timeout-class errors
 * so the caller can distinguish "DB down" from "your SQL is broken".
 */
export async function query(text, params = []) {
  const attempts = [];
  for (let i = 0; i < 2; i++) {
    let client;
    try {
      client = await getPool().connect();
      try {
        if (!client.__constySearchPathReady) {
          // Neon pooled connections can come up with an empty search_path.
          // Set it once per client so existing unqualified table queries
          // resolve consistently against the public schema.
          await client.query('SET search_path TO public');
          client.__constySearchPathReady = true;
        }
        return await client.query(text, params);
      } finally {
        client.release();
      }
    } catch (err) {
      attempts.push(err);
      const kind = classifyError(err);

      if (kind === 'transient' && i === 0) {
        // Short backoff and try once more — typically the second attempt
        // hits a freshly-built socket.
        await new Promise(r => setTimeout(r, 300));
        continue;
      }

      if (kind === 'timeout') {
        // Don't multiply the wait; surface immediately.
        throw new DatabaseUnavailableError(err);
      }

      // Query/SQL error or second-attempt transient — bubble as-is.
      throw err;
    }
  }
  // Unreachable
  throw attempts[attempts.length - 1];
}

export function getPool() {
  if (!pool) initializePool();
  return pool;
}

export async function testConnection() {
  try {
    const r = await query('SELECT 1');
    return !!r.rows;
  } catch (err) {
    console.error('[db] test connection failed:', err.message);
    return false;
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export default { query, getPool, testConnection, closePool, DatabaseUnavailableError };
