/**
 * GET /api/auth/passkeys/register-options
 *
 * Generates WebAuthn registration options for the currently authenticated user.
 * Response is sent to the browser which passes it to navigator.credentials.create().
 *
 * Security:
 *  - Requires active session (user must be logged in to enroll biometrics)
 *  - Challenge stored in DB with 5-min TTL
 *  - Excludes already-registered credentials (prevents duplicates)
 */

import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { verifyAuth } from '@/lib/auth-utils.js';
import {
  getRpId, getRpName,
  saveChallenge, getPasskeysByUserId,
} from '@/lib/passkeys.js';

export async function GET(request) {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const rpId   = getRpId();
    const rpName = getRpName();

    // Fetch existing credentials so we can exclude them
    const existingPasskeys = await getPasskeysByUserId(user.userId);
    const excludeCredentials = existingPasskeys.map(p => ({
      id:         p.credential_id,       // base64url string — simplewebauthn v13 accepts strings
      transports: p.transports ?? [],
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userName:        user.email,
      userDisplayName: user.name || user.email,
      // Prefer platform (built-in biometrics) but allow roaming keys too
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey:             'preferred',
        userVerification:        'required',
      },
      attestationType:     'none',        // No attestation verification needed
      excludeCredentials,
      supportedAlgorithmIDs: [-7, -257],  // ES256 + RS256
    });

    // Store challenge before responding
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    await saveChallenge({
      challenge:  options.challenge,
      type:       'registration',
      userId:     user.userId,
      ipAddress:  ip,
    });

    return NextResponse.json({ success: true, options });
  } catch (error) {
    console.error('[passkeys/register-options]', error);
    return NextResponse.json({ success: false, error: 'Failed to generate registration options' }, { status: 500 });
  }
}
