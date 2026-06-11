/**
 * /api/auth/passkeys — Device management
 *
 * GET    → list all registered passkeys for the current user
 * PATCH  → rename a passkey (body: { passkeyId, deviceName })
 * DELETE → revoke (remove) a passkey (body: { passkeyId })
 *
 * All methods require an active session.
 */

import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils.js';
import {
  getPasskeysByUserId, renamePasskey, deletePasskey,
} from '@/lib/passkeys.js';

// ─── GET — list devices ─────────────────────────────────────────────────────
export async function GET(request) {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const passkeys = await getPasskeysByUserId(user.userId);
    return NextResponse.json({ success: true, data: passkeys });
  } catch (error) {
    console.error('[passkeys GET]', error);
    return NextResponse.json({ success: false, error: 'Failed to load passkeys' }, { status: 500 });
  }
}

// ─── PATCH — rename device ──────────────────────────────────────────────────
export async function PATCH(request) {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const { passkeyId, deviceName } = await request.json();

    if (!passkeyId || !deviceName?.trim()) {
      return NextResponse.json({ success: false, error: 'passkeyId and deviceName required' }, { status: 400 });
    }

    const updated = await renamePasskey(passkeyId, user.userId, deviceName.trim());
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Passkey not found or not yours' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[passkeys PATCH]', error);
    return NextResponse.json({ success: false, error: 'Failed to rename passkey' }, { status: 500 });
  }
}

// ─── DELETE — revoke device ─────────────────────────────────────────────────
export async function DELETE(request) {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const { passkeyId } = await request.json();

    if (!passkeyId) {
      return NextResponse.json({ success: false, error: 'passkeyId required' }, { status: 400 });
    }

    const deleted = await deletePasskey(passkeyId, user.userId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Passkey not found or not yours' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Passkey removed' });
  } catch (error) {
    console.error('[passkeys DELETE]', error);
    return NextResponse.json({ success: false, error: 'Failed to remove passkey' }, { status: 500 });
  }
}
