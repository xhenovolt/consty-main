-- Migration 963: WebAuthn Passkeys (Biometric Authentication)
-- Adds support for passkey registration, authentication, and challenge tracking.
-- Phase 1 of biometric auth implementation.

-- ─── 1. PASSKEY CREDENTIALS ────────────────────────────────────────────────
-- Stores one row per registered authenticator device per user.
CREATE TABLE IF NOT EXISTS auth_passkeys (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The credential ID returned by the authenticator (base64url encoded).
  credential_id   TEXT        NOT NULL UNIQUE,
  -- CBOR-encoded public key stored as base64url text.
  public_key      TEXT        NOT NULL,
  -- Signature counter — incremented by authenticator each use.
  -- Server MUST verify it only ever increases (replay-attack prevention).
  counter         BIGINT      NOT NULL DEFAULT 0,
  -- Human-readable label set by user ("Work Laptop", "Samsung S24").
  device_name     TEXT        NOT NULL DEFAULT 'My Device',
  -- Transport hints returned during registration (json array: usb,nfc,ble,internal).
  transports      JSONB       DEFAULT '[]'::jsonb,
  -- Raw attestation object stored for auditing.
  aaguid          TEXT        DEFAULT NULL,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at    TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_passkeys_user_id      ON auth_passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_passkeys_credential_id ON auth_passkeys(credential_id);

-- ─── 2. CHALLENGE STORE ────────────────────────────────────────────────────
-- Temporary table used as a Redis substitute for storing in-flight challenges.
-- Each challenge is scoped to user+type+session. TTL enforced in application layer.
-- Rows over 10 minutes old are considered expired.
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- user_id is NULL during authentication (before we know who the user is)
  user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
  -- 'registration' | 'authentication'
  type        TEXT        NOT NULL CHECK (type IN ('registration', 'authentication')),
  challenge   TEXT        NOT NULL,
  -- IP address for basic anti-abuse throttling (optional filter)
  ip_address  TEXT        DEFAULT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Challenges expire after 5 minutes
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes')
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user_type ON webauthn_challenges(user_id, type);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires_at ON webauthn_challenges(expires_at);
