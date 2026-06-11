/**
 * DRAIS Platform v1 client — the SAFE SHADOW CONSUMER.
 *
 * This is intentionally separate from src/lib/draisClient.ts which targets
 * the legacy /api/external/* + x-api-key surface and is allowed to mutate.
 * The platform v1 client below is the new path documented in the operator
 * handover: bearer auth, idempotency, scopes, audit, webhooks.
 *
 * For Commit 1 we expose ONLY read paths (`get`). Writes are intentionally
 * absent — adding them is a separate, deliberate decision after the
 * observability data confirms the surface is stable.
 *
 * Every call is logged to drais_api_calls (migration 972). That table is
 * the source-of-truth for the CONSTY × DRAIS contract reality report.
 */

import crypto from 'node:crypto';
import { query } from './db.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;

function baseUrl() {
  const url = process.env.DRAIS_PLATFORM_BASE_URL;
  if (!url) {
    throw new Error('DRAIS_PLATFORM_BASE_URL is not set. Expected something like https://drais-deploy.vercel.app/api/platform/v1');
  }
  return url.replace(/\/+$/, '');
}

function token() {
  const t = process.env.DRAIS_PLATFORM_TOKEN;
  if (!t) {
    throw new Error('DRAIS_PLATFORM_TOKEN is not set. Format: pk_live_<keyId>.<secret>');
  }
  return t;
}

/**
 * Sleep with jitter for retry backoff. Caller chooses base.
 */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Decide if a status code (or fetch error) is worth retrying. Per handover:
 *   - 5xx retryable
 *   - 429 retryable, honour Retry-After
 *   - 4xx NOT retryable except 429
 *   - network errors retryable
 */
function shouldRetry(status, attempt) {
  if (attempt >= MAX_RETRIES) return false;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

/**
 * Persist a call record. Non-fatal — if observability DB is down we still
 * return the response so the caller's UX isn't held up.
 */
async function logCall(row) {
  try {
    await query(
      `INSERT INTO drais_api_calls
         (request_id, method, endpoint, status_code, latency_ms,
          response_size, error_code, attempt, idempotency_key, called_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())`,
      [
        row.request_id || null,
        row.method,
        row.endpoint,
        row.status_code || null,
        row.latency_ms,
        row.response_size || null,
        row.error_code || null,
        row.attempt,
        row.idempotency_key || null,
      ]
    );
  } catch (err) {
    console.warn('[drais-platform] failed to log call:', err.message);
  }
}

/**
 * Core request function. ALL DRAIS platform traffic goes through here so the
 * observability table is complete by construction.
 *
 * @param {string} method  'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
 * @param {string} path    e.g. '/health' or '/schools?limit=2' (relative to base)
 * @param {object} opts
 *   - body         : object to JSON.stringify (writes only)
 *   - idempotencyKey : explicit key; auto-generated for writes if omitted
 *   - timeoutMs    : override default 10s
 *   - readOnly     : if true, reject non-GET methods at the SDK boundary
 */
export async function request(method, path, opts = {}) {
  const m = method.toUpperCase();
  if (opts.readOnly && m !== 'GET') {
    throw new Error(`drais-platform: readOnly mode rejects ${m} ${path}`);
  }

  const url = `${baseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
  const isWrite = m === 'POST' || m === 'PATCH' || m === 'PUT' || m === 'DELETE';
  const idempotencyKey = isWrite
    ? (opts.idempotencyKey || crypto.randomUUID())
    : null;

  const headers = {
    'Authorization': `Bearer ${token()}`,
    'Accept': 'application/json',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs || DEFAULT_TIMEOUT_MS);
    const t0 = Date.now();

    let res, bodyText = '', responseSize = null, statusCode = 0, requestId = null, errorCode = null;
    try {
      res = await fetch(url, {
        method: m,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
      statusCode = res.status;
      requestId = res.headers.get('x-request-id') || null;
      bodyText = await res.text();
      responseSize = bodyText.length;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      const latency_ms = Date.now() - t0;
      await logCall({
        request_id: null, method: m, endpoint: path,
        status_code: null, latency_ms, response_size: null,
        error_code: err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK',
        attempt, idempotency_key: idempotencyKey,
      });
      if (shouldRetry(null, attempt)) {
        await sleep(Math.min(2 ** attempt * 250, 4000));
        continue;
      }
      throw new DraisPlatformError(err.message, { cause: err, code: 'NETWORK' });
    }

    const latency_ms = Date.now() - t0;

    let parsed = null;
    try { parsed = bodyText ? JSON.parse(bodyText) : null; }
    catch {/* not JSON — leave parsed=null */}

    if (parsed && parsed.success === false && parsed.error?.code) {
      errorCode = parsed.error.code;
    } else if (!res.ok) {
      errorCode = `HTTP_${statusCode}`;
    }

    await logCall({
      request_id: requestId, method: m, endpoint: path,
      status_code: statusCode, latency_ms, response_size: responseSize,
      error_code: errorCode, attempt, idempotency_key: idempotencyKey,
    });

    if (res.ok && parsed?.success === true) {
      return {
        ok: true,
        data: parsed.data,
        requestId,
        rateLimit: {
          limit:     Number(res.headers.get('x-ratelimit-limit'))     || null,
          remaining: Number(res.headers.get('x-ratelimit-remaining')) || null,
          reset:     Number(res.headers.get('x-ratelimit-reset'))     || null,
        },
        apiVersion: res.headers.get('x-api-version'),
        idempotentReplay: res.headers.get('x-idempotent-replay') === 'true',
        latencyMs: latency_ms,
        attempt,
      };
    }

    // Retry on 5xx + 429 — honour Retry-After on 429.
    if (shouldRetry(statusCode, attempt)) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(2 ** attempt * 250, 4000);
      await sleep(wait);
      continue;
    }

    throw new DraisPlatformError(
      parsed?.error?.message || `HTTP ${statusCode}`,
      { code: errorCode || 'UNKNOWN', status: statusCode, requestId, body: parsed }
    );
  }
  // Exhausted retries
  throw new DraisPlatformError('Exhausted retries', { cause: lastError, code: 'RETRY_EXHAUSTED' });
}

/**
 * Convenience: GET wrapper that enforces read-only at the SDK boundary.
 * Use this for the shadow-consumer phase — anything that calls request()
 * directly with a write method is opting out of the safety enforcement.
 */
export function get(path, opts = {}) {
  return request('GET', path, { ...opts, readOnly: true });
}

/**
 * Typed error for callers. Carries the platform error code so UIs can branch
 * on UNAUTHORIZED / INSUFFICIENT_SCOPE / RATE_LIMITED etc.
 */
export class DraisPlatformError extends Error {
  constructor(message, { code, status, requestId, body, cause } = {}) {
    super(message);
    this.name = 'DraisPlatformError';
    this.code = code || 'UNKNOWN';
    this.status = status || null;
    this.requestId = requestId || null;
    this.body = body || null;
    if (cause) this.cause = cause;
  }
}

/**
 * Inspect whether the platform integration is even configured. Used by the
 * health page to render a useful "set DRAIS_PLATFORM_BASE_URL and
 * DRAIS_PLATFORM_TOKEN" message instead of a generic 500.
 */
export function configuredness() {
  return {
    base_url_set: !!process.env.DRAIS_PLATFORM_BASE_URL,
    token_set:    !!process.env.DRAIS_PLATFORM_TOKEN,
    webhook_secret_set: !!process.env.DRAIS_WEBHOOK_SECRET,
  };
}
