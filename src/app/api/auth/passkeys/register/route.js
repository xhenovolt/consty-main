/**
 * POST /api/auth/passkeys/register
 *
 * Verifies the authenticator's attestation response and persists the new
 * credential in auth_passkeys.
 *
 * Body: {
 *   credential: PublicKeyCredential (JSON-serialised by @simplewebauthn/browser)
 *   deviceName: string   // optional user label, e.g. "Work Laptop"
 * }
 *
 * Security:
 *  - Validates challenge (consume-once from DB)
 *  - Validates origin & rpId
 *  - Requires user verification (UV = true)
 *  - No credential stored if verification fails
 */

import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { verifyAuth } from '@/lib/auth-utils.js';
import {
  getRpId, getRpOrigin,
  consumeChallenge, savePasskey,
} from '@/lib/passkeys.js';

export async function POST(request) {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { credential, deviceName } = body;

    if (!credential) {
      return NextResponse.json({ success: false, error: 'Missing credential' }, { status: 400 });
    }

    // Retrieve & delete the challenge we previously stored
    const expectedChallenge = await consumeChallenge({
      userId: user.userId,
      type:   'registration',
    });

    if (!expectedChallenge) {
      return NextResponse.json(
        { success: false, error: 'Challenge expired or not found. Please try again.' },
        { status: 400 }
      );
    }

    const verification = await verifyRegistrationResponse({
      response:          credential,
      expectedChallenge,
      expectedOrigin:    getRpOrigin(),
      expectedRPID:      getRpId(),
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 400 });
    }

    const { registrationInfo } = verification;
    const {
      credential:  cred,      // { id, publicKey, counter, transports }
      aaguid,
    } = registrationInfo;

    // Label falls back to a generic name if not provided
    const label = (deviceName || '').trim() || 'My Device';

    const passkey = await savePasskey({
      userId:       user.userId,
      credentialId: cred.id,
      publicKey:    cred.publicKey,
      counter:      cred.counter,
      transports:   cred.transports ?? [],
      deviceName:   label,
      aaguid:       aaguid?.toString() ?? null,
    });

    return NextResponse.json({
      success:  true,
      message:  'Passkey registered successfully',
      passkeyId: passkey.id,
    });
  } catch (error) {
    console.error('[passkeys/register]', error);
    return NextResponse.json({ success: false, error: 'Registration failed' }, { status: 500 });
  }
}
