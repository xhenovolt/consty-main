/**
 * POST /api/integrations/[id]/rotate-keys
 * 
 * Rotates API key and/or secret for a connection
 * Requires password verification token
 * Supports: auto-generate new keys OR manual input
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';
import { encryptSecret, decryptSecret } from '@/lib/encryption.js';
import crypto from 'crypto';

export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'integrations.edit');
  if (perm instanceof NextResponse) return perm;

  try {
    const { auth } = perm;
    const { id } = params;
    const body = await request.json();

    const {
      token, // secret view token for auth
      mode, // 'auto' or 'manual'
      new_api_key,
      new_api_secret,
      revoke_old_immediately, // boolean
    } = body;

    // Verify token
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Secret view token required' },
        { status: 401 }
      );
    }

    const tokenResult = await query(
      `SELECT id, user_id FROM secret_view_tokens 
       WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    if (tokenResult.rows[0].user_id !== auth.userId) {
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

    // Decrypt old values to store as backup
    let old_api_key, old_api_secret;
    try {
      old_api_key = decryptSecret(connection.api_key_encrypted);
      old_api_secret = decryptSecret(connection.api_secret_encrypted);
    } catch (err) {
      return NextResponse.json(
        { success: false, error: 'Failed to process current credentials' },
        { status: 500 }
      );
    }

    // Determine new values based on mode
    let new_key_for_db, new_secret_for_db;

    if (mode === 'auto') {
      // Auto-generate new keys
      new_key_for_db = 'sk_' + crypto.randomBytes(32).toString('hex');
      new_secret_for_db = 'ss_' + crypto.randomBytes(32).toString('hex');
    } else if (mode === 'manual') {
      // Use manually provided values
      if (!new_api_key || !new_api_secret) {
        return NextResponse.json(
          { success: false, error: 'API key and secret required for manual mode' },
          { status: 400 }
        );
      }
      new_key_for_db = new_api_key;
      new_secret_for_db = new_api_secret;
    } else {
      return NextResponse.json(
        { success: false, error: 'Mode must be "auto" or "manual"' },
        { status: 400 }
      );
    }

    // Encrypt new values
    let new_key_encrypted, new_secret_encrypted;
    try {
      new_key_encrypted = encryptSecret(new_key_for_db);
      new_secret_encrypted = encryptSecret(new_secret_for_db);
    } catch (err) {
      console.error('[Integrations] Encryption failed:', err);
      return NextResponse.json(
        { success: false, error: 'Failed to encrypt new credentials' },
        { status: 500 }
      );
    }

    // Update connection in database
    try {
      await query(
        `UPDATE external_connections 
         SET api_key_encrypted = $1, 
             api_secret_encrypted = $2,
             rotated_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [new_key_encrypted, new_secret_encrypted, id]
      );
    } catch (err) {
      console.error('[Integrations] Database update failed:', err);
      return NextResponse.json(
        { success: false, error: 'Failed to update credentials' },
        { status: 500 }
      );
    }

    // Store rotation history in audit log
    try {
      await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, status, metadata)
         VALUES ($1, 'ROTATED_API_KEYS', 'integration_secret', $2, 'success', $3)`,
        [
          auth.userId,
          id,
          JSON.stringify({
            connection_name: connection.name,
            mode: mode,
            old_key_masked: old_api_key.substring(0, 4) + '****',
            new_key_masked: new_key_for_db.substring(0, 4) + '****',
            revoke_old_immediately: revoke_old_immediately,
          }),
        ]
      );
    } catch (logErr) {
      console.warn('[Integrations] Failed to log key rotation:', logErr);
    }

    // Phase 5: Sync with DRAIS (if system type is drais)
    let drais_sync_status = 'skipped';
    if (connection.system_type === 'drais') {
      try {
        // Get active DRAIS connection's decrypted credentials for making the sync call
        const draisConnResult = await query(
          `SELECT api_key_encrypted, api_secret_encrypted, base_url 
           FROM external_connections 
           WHERE system_type = 'drais' AND is_active = true LIMIT 1`,
          []
        );

        if (draisConnResult.rows.length > 0) {
          const draisConn = draisConnResult.rows[0];

          try {
            const drais_key = decrypt(draisConn.api_key_encrypted);
            const drais_secret = decrypt(draisConn.api_secret_encrypted);

            // Call DRAIS API to sync new keys
            const syncResponse = await fetch(
              new URL('/api/control/update-keys', draisConn.base_url).toString(),
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-API-Key': drais_key,
                  'X-API-Secret': drais_secret,
                },
                body: JSON.stringify({
                  new_api_key: new_key_for_db,
                  new_api_secret: new_secret_for_db,
                  revoke_old_immediately: revoke_old_immediately || false,
                }),
              }
            );

            if (syncResponse.ok) {
              drais_sync_status = 'synced';
            } else {
              drais_sync_status = 'sync_failed';
              console.error('[Integrations] DRAIS sync failed:', syncResponse.status);
            }
          } catch (syncErr) {
            drais_sync_status = 'sync_error';
            console.error('[Integrations] DRAIS sync error:', syncErr);
          }
        }
      } catch (err) {
        console.warn('[Integrations] DRAIS sync skipped:', err);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: connection.id,
        name: connection.name,
        rotated_at: new Date(),
      },
      sync_status: drais_sync_status,
      message:
        drais_sync_status === 'synced'
          ? 'Keys rotated and synced with DRAIS'
          : 'Keys rotated successfully',
    });
  } catch (error) {
    console.error('[Integrations] Key rotation error:', error);
    return NextResponse.json(
      { success: false, error: 'Key rotation failed' },
      { status: 500 }
    );
  }
}
