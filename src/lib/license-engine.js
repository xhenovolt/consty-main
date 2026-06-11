/**
 * License Engine — key generation, lifecycle helpers, and audit utilities.
 *
 * The license key format is `JTN-XXXX-XXXX-XXXX-XXXX` where each XXXX is 4
 * uppercase alphanumeric characters with a final 4-char checksum derived from
 * the body so a tampered key fails validation without a DB hit.
 */

import crypto from 'node:crypto';
import { query } from './db.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ambiguous chars dropped (I, O, 0, 1)

function randomBlock(len = 4) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function checksum(body) {
  const h = crypto.createHash('sha256').update(body).digest();
  let out = '';
  for (let i = 0; i < 4; i++) out += ALPHABET[h[i] % ALPHABET.length];
  return out;
}

export function generateLicenseKey() {
  const blocks = [randomBlock(), randomBlock(), randomBlock(), randomBlock()];
  const body = blocks.join('-');
  const cs = checksum(body);
  return `JTN-${blocks[0]}-${blocks[1]}-${blocks[2]}-${cs}`;
}

export function verifyLicenseKeyFormat(key) {
  if (typeof key !== 'string') return false;
  const m = key.match(/^JTN-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/);
  if (!m) return false;
  const [, a, b, c, cs] = m;
  return checksum(`${a}-${b}-${c}`) === cs;
}

export function generateActivationToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function logLicenseEvent({
  license_id, event_type, actor_id, description, before_state, after_state, metadata,
}) {
  try {
    await query(
      `INSERT INTO license_events
         (license_id, event_type, actor_id, description, before_state, after_state, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        license_id,
        event_type,
        actor_id || null,
        description || null,
        before_state ? JSON.stringify(before_state) : null,
        after_state  ? JSON.stringify(after_state)  : null,
        metadata     ? JSON.stringify(metadata)     : '{}',
      ]
    );
  } catch (err) {
    console.error('[license-engine] logLicenseEvent failed:', err.message);
  }
}

export async function logLicenseAudit({
  license_id, action, actor_id, ip_address, user_agent, details,
}) {
  try {
    await query(
      `INSERT INTO license_audit_logs
         (license_id, action, actor_id, ip_address, user_agent, details)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        license_id || null,
        action,
        actor_id || null,
        ip_address || null,
        user_agent || null,
        details ? JSON.stringify(details) : '{}',
      ]
    );
  } catch (err) {
    console.error('[license-engine] logLicenseAudit failed:', err.message);
  }
}

export function computeLicenseStatus(license, now = new Date()) {
  if (license.revoked_at) return 'revoked';
  if (license.suspended_at) return 'suspended';
  if (license.expires_at && new Date(license.expires_at) < now) return 'expired';
  if (license.activated_at) return 'active';
  if (license.license_type === 'trial') return 'trial';
  return 'pending';
}

export function diffStates(before, after) {
  const out = {};
  for (const k of Object.keys(after || {})) {
    if (JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])) {
      out[k] = { from: before?.[k] ?? null, to: after?.[k] ?? null };
    }
  }
  return out;
}

export function clientFromRequest(req) {
  const ip = req.headers.get?.('x-forwarded-for')?.split(',')[0]?.trim()
          || req.headers.get?.('x-real-ip')
          || null;
  const ua = req.headers.get?.('user-agent') || null;
  return { ip, ua };
}
