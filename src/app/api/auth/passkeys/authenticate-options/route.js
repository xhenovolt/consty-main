/**
 * GET /api/auth/passkeys/authenticate-options
 *
 * Generates WebAuthn authentication options.
 * This endpoint is public (no session required) — the user is not yet
 * authenticated when starting the biometric login flow.
 *
 * If an `email` query param is supplied, we can scope allowCredentials to
 * that user's registered passkeys, improving UX (less "discoverable key"
 * friction on older authenticators).  If not provided, we send an empty
 * list so the browser chooses from any discoverable credential.
 *
 * Security:
 *  - Challenge stored in DB with 5-min TTL
 *  - No sensitive user data returned here (only credential IDs & transports)
 *  - Replay-attack prevention via consumed-once challenges + counter check
 */

import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { query } from '@/lib/db.js';
import {
  getRpId, saveChallenge, getPasskeysByUserId,
} from '@/lib/passkeys.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = (searchParams.get('email') || '').trim().toLowerCase();

    let allowCredentials = [];
    let userId  = null;

    if (email) {
      // Look up user by email to populate allowCredentials
      const userRes = await query(
        `SELECT id FROM users WHERE LOWER(email) = $1 AND status = 'active' LIMIT 1`,
        [email]
      );
      if (userRes.rows[0]) {
        userId = userRes.rows[0].id;
        const passkeys = await getPasskeysByUserId(userId);
        allowCredentials = passkeys.map(p => ({
          id:         p.credential_id,
          transports: p.transports ?? [],
        }));
      }
      // If user not found or has no passkeys we proceed with empty list
      // (authenticator will do a discoverable-credential lookup)
    }

    const options = await generateAuthenticationOptions({
      rpID:             getRpId(),
      userVerification: 'required',
      allowCredentials,
      timeout:          60_000,
    });

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    await saveChallenge({
      challenge:  options.challenge,
      type:       'authentication',
      userId,       // null if no email supplied
      ipAddress:  ip,
    });

    return NextResponse.json({ success: true, options });
  } catch (error) {
    console.error('[passkeys/authenticate-options]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate authentication options' },
      { status: 500 }
    );
  }
}
