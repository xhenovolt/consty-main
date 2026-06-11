/**
 * POST /api/integrations/verify-password
 * 
 * Verifies user password before allowing secret exposure
 * Required for viewing/rotating API credentials
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db.js';

export async function POST(request) {
  const perm = await requirePermission(request, 'integrations.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { auth } = perm;
    const { password } = await request.json();

    if (!password || password.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Password required' },
        { status: 400 }
      );
    }

    // Get user from database
    const userResult = await query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [auth.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      // Log failed attempt for security
      try {
        await query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, status, metadata)
           VALUES ($1, 'FAILED_PASSWORD_VERIFICATION', 'integration_secret', NULL, 'failed', $2)`,
          [auth.userId, JSON.stringify({ reason: 'invalid_password' })]
        );
      } catch (logErr) {
        console.warn('[Integrations] Failed to log password verification:', logErr);
      }

      return NextResponse.json(
        { success: false, error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Password is valid - generate temporary token for secret viewing
    // Token is short-lived (15 minutes max) and single-use
    const token = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    try {
      await query(
        `INSERT INTO secret_view_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [auth.userId, token, expiresAt]
      );
    } catch (err) {
      console.error('[Integrations] Failed to create view token:', err);
      return NextResponse.json(
        { success: false, error: 'Failed to verify password' },
        { status: 500 }
      );
    }

    // Log successful password verification
    try {
      await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, status, metadata)
         VALUES ($1, 'PASSWORD_VERIFIED_FOR_SECRET', 'integration_secret', 'success', $2)`,
        [auth.userId, JSON.stringify({ token_generated: true })]
      );
    } catch (logErr) {
      console.warn('[Integrations] Failed to log password verification:', logErr);
    }

    return NextResponse.json({
      success: true,
      token, // Frontend must include this in subsequent request to view secrets
      expiresIn: 15 * 60, // seconds
      message: 'Password verified. Secrets available for 15 minutes.',
    });
  } catch (error) {
    console.error('[Integrations] Password verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Password verification failed' },
      { status: 500 }
    );
  }
}
