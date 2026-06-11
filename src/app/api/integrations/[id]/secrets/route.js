/**
 * GET /api/integrations/[id]/secrets
 * 
 * Returns decrypted API key and secret ONLY after password verification token is valid
 * Must include valid token from password verification endpoint
 * Token is time-limited (15 minutes) and single-use
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';
import { decryptSecret } from '@/lib/encryption.js';

export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'integrations.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { auth } = perm;
    const { id } = params;

    // Get token from query parameters or headers
    const url = new URL(request.url);
    const token = url.searchParams.get('token') || request.headers.get('x-secret-token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Secret view token required' },
        { status: 401 }
      );
    }

    // Verify token is valid and not expired
    const tokenResult = await query(
      `SELECT id, user_id, expires_at FROM secret_view_tokens 
       WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired secret view token' },
        { status: 401 }
      );
    }

    const viewToken = tokenResult.rows[0];

    // Verify token belongs to current user
    if (viewToken.user_id !== auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Token does not match user' },
        { status: 403 }
      );
    }

    // Get connection
    const connResult = await query(
      'SELECT * FROM external_connections WHERE id = $1',
      [id]
    );

    if (connResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Connection not found' },
        { status: 404 }
      );
    }

    const connection = connResult.rows[0];

    // Decrypt credentials
    let api_key, api_secret;
    try {
      api_key = decryptSecret(connection.api_key_encrypted);
      api_secret = decryptSecret(connection.api_secret_encrypted);
    } catch (err) {
      console.error('[Integrations] Failed to decrypt:', err);
      return NextResponse.json(
        { success: false, error: 'Failed to decrypt credentials' },
        { status: 500 }
      );
    }

    // Mark token as used (can only be used once)
    try {
      await query(
        `UPDATE secret_view_tokens SET used_at = NOW() WHERE id = $1`,
        [viewToken.id]
      );
    } catch (err) {
      console.warn('[Integrations] Failed to mark token as used:', err);
    }

    // Log the secret view
    try {
      await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, status, metadata)
         VALUES ($1, 'VIEWED_API_SECRET', 'integration_secret', $2, 'success', $3)`,
        [
          auth.userId,
          id,
          JSON.stringify({
            connection_name: connection.name,
            ip_address: request.headers.get('x-forwarded-for') || 'unknown',
          }),
        ]
      );
    } catch (logErr) {
      console.warn('[Integrations] Failed to log secret view:', logErr);
    }

    // Return decrypted secrets
    // Frontend is responsible for:
    // 1. Not storing these in long-term state
    // 2. Not logging them
    // 3. Auto-hiding after timer expires
    return NextResponse.json({
      success: true,
      data: {
        id: connection.id,
        name: connection.name,
        api_key: api_key, // FULL VALUE - frontend must handle carefully
        api_secret: api_secret, // FULL VALUE - frontend must handle carefully
        expires_at: new Date(Date.now() + 15 * 1000), // Expires in 15 seconds on frontend
      },
      message: 'Secrets retrieved. They will auto-hide in 15 seconds.',
    });
  } catch (error) {
    console.error('[Integrations] Get secrets error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve secrets' },
      { status: 500 }
    );
  }
}
