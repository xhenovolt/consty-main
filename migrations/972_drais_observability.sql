-- Migration 972: DRAIS Platform v1 observability table.
-- Idempotent.
--
-- Source of truth for the CONSTY × DRAIS contract reality report. Every
-- call made by src/lib/drais-platform.js writes one row here (including
-- network errors and timeouts) so we can answer:
--   * Are 5xx rates trending up?
--   * What's the p50/p95 latency per endpoint?
--   * Which error codes dominate?
--   * Are idempotency keys actually being used on writes?

CREATE TABLE IF NOT EXISTS drais_api_calls (
  id              BIGSERIAL PRIMARY KEY,
  request_id      VARCHAR(64),            -- X-Request-Id from DRAIS, NULL on network failure
  method          VARCHAR(10) NOT NULL,   -- GET / POST / etc.
  endpoint        TEXT        NOT NULL,   -- '/health', '/schools?limit=2', ...
  status_code     INTEGER,                -- NULL on network failure or timeout
  latency_ms      INTEGER     NOT NULL,
  response_size   INTEGER,                -- bytes of JSON body
  error_code      VARCHAR(64),            -- TIMEOUT | NETWORK | INSUFFICIENT_SCOPE | HTTP_5xx | ...
  attempt         SMALLINT    NOT NULL DEFAULT 1,
  idempotency_key VARCHAR(64),            -- only present on POST/PATCH/PUT/DELETE
  called_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drais_api_calls_called_at  ON drais_api_calls(called_at DESC);
CREATE INDEX IF NOT EXISTS idx_drais_api_calls_endpoint   ON drais_api_calls(endpoint);
CREATE INDEX IF NOT EXISTS idx_drais_api_calls_error_code ON drais_api_calls(error_code) WHERE error_code IS NOT NULL;
