/**
 * POST /api/auth/passkeys/authenticate
 *
 * Verifies an authentication assertion and creates a normal Consty session.
 *
 * Body: {
 *   credential: AuthenticatorAssertionResponse (JSON from @simplewebauthn/browser)
 *   email?:     string   // used only to find the correct challenge row
 * }
 *
 * Security:
 *  - Validates signature against stored public key
 *  - Enforces counter monotonicity (prevent replay attacks)
 *  - Validates origin + rpId
 *  - Creates a standard Consty session (NO JWT)
 *  - Full RBAC preserved — biometric only provides identity, not elevated privilege
 */

import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { query } from '@/lib/db.js';
import { logAuthEvent, extractRequestMetadata } from '@/lib/audit.js';
import { createSession, getSecureCookieOptions } from '@/lib/session.js';
import {
  getRpId, getRpOrigin,
  consumeChallenge,
  getPasskeyByCredentialId, updatePasskeyCounter,
} from '@/lib/passkeys.js';

export async function POST(request) {
  const requestMetadata = extractRequestMetadata(request);

  try {
    const body = await request.json();
    const { credential, email } = body;

    if (!credential?.id) {
      return NextResponse.json({ success: false, error: 'Missing credential' }, { status: 400 });
    }

    // Look up credential in our DB to find which user this is
    const passkey = await getPasskeyByCredentialId(credential.id);
    if (!passkey) {
      return NextResponse.json({ success: false, error: 'Credential not found' }, { status: 401 });
    }

    // Guard: user account must be active
    if (passkey.status !== 'active') {
      await logAuthEvent({
        action:          'PASSKEY_AUTH_BLOCKED',
        userId:          passkey.user_id,
        email:           passkey.email,
        reason:          `Account status: ${passkey.status}`,
        requestMetadata,
      });
      return NextResponse.json(
        { success: false, error: 'Account is not active' },
        { status: 403 }
      );
    }

    // Retrieve & delete the stored challenge
    // Try user-scoped first, then fall back to anonymous row
    let expectedChallenge = await consumeChallenge({
      userId: passkey.user_id,
      type:   'authentication',
    });
    if (!expectedChallenge) {
      expectedChallenge = await consumeChallenge({ userId: null, type: 'authentication' });
    }
    if (!expectedChallenge) {
      return NextResponse.json(
        { success: false, error: 'Challenge expired. Please try again.' },
        { status: 400 }
      );
    }

    // Decode stored public key (base64url → Uint8Array for simplewebauthn v13)
    const publicKeyBytes = Buffer.from(passkey.public_key, 'base64url');

    const verification = await verifyAuthenticationResponse({
      response:          credential,
      expectedChallenge,
      expectedOrigin:    getRpOrigin(),
      expectedRPID:      getRpId(),
      requireUserVerification: true,
      credential: {
        id:         passkey.credential_id,
        publicKey:  publicKeyBytes,
        counter:    passkey.counter,
        transports: passkey.transports ?? [],
      },
    });

    if (!verification.verified) {
      await logAuthEvent({
        action:  'PASSKEY_AUTH_FAILURE',
        userId:  passkey.user_id,
        email:   passkey.email,
        reason:  'Signature verification failed',
        requestMetadata,
      });
      return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 401 });
    }

    // Update counter to prevent future replay attacks
    const { authenticationInfo } = verification;
    await updatePasskeyCounter(passkey.credential_id, authenticationInfo.newCounter);

    // ── CREATE CONSTY SESSION (identical to password login) ─────────────────
    const { deviceName } = parseUAInfo(request);

    const sessionId = await createSession(passkey.user_id, {
      deviceName: deviceName || passkey.device_name || 'Biometric',
      ipAddress:  requestMetadata?.ipAddress ?? null,
      userAgent:  requestMetadata?.userAgent ?? null,
    });

    // Update presence
    try {
      await query(
        `INSERT INTO user_presence (user_id, last_ping, last_seen, status, is_online, updated_at)
         VALUES ($1, NOW(), NOW(), 'online', true, NOW())
         ON CONFLICT (user_id) DO UPDATE
         SET last_ping = NOW(), last_seen = NOW(), status = 'online',
             is_online = true, updated_at = NOW()`,
        [passkey.user_id]
      );
      await query(
        `UPDATE users SET is_online = true, last_seen = NOW(),
                          last_seen_at = NOW(), session_id = $2
         WHERE id = $1`,
        [passkey.user_id, sessionId]
      );
    } catch (presenceErr) {
      console.warn('[passkeys/authenticate] presence update failed:', presenceErr.message);
    }

    await logAuthEvent({
      action:          'PASSKEY_AUTH_SUCCESS',
      userId:          passkey.user_id,
      email:           passkey.email,
      requestMetadata,
    });

    const response = NextResponse.json({ success: true, message: 'Authenticated successfully' });
    response.cookies.set('consty_session', sessionId, getSecureCookieOptions());

    return response;
  } catch (error) {
    console.error('[passkeys/authenticate]', error);
    return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 500 });
  }
}

/** Minimal UA parsing to label the session device type. */
function parseUAInfo(request) {
  const ua = request.headers.get('user-agent') || '';
  let deviceName = 'Desktop';
  if (/Mobile|Android|iPhone/.test(ua))  deviceName = 'Mobile (Biometric)';
  else if (/Tablet|iPad/.test(ua))        deviceName = 'Tablet (Biometric)';
  else                                    deviceName = 'Desktop (Biometric)';
  return { deviceName };
}
