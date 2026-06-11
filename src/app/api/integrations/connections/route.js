/**
 * GET /api/integrations/connections
 * POST /api/integrations/connections
 * 
 * Manage external API connections (list, create)
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';
import { encryptSecret, maskCredential } from '@/lib/encryption.js';
import { dispatch } from '@/lib/system-events.js';

/**
 * GET /api/integrations/connections
 * 
 * List all external connections
 * Returns connections with masked credentials
 */
export async function GET(request) {
  const perm = await requirePermission(request, 'integrations.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const result = await query(
      `SELECT 
        id, 
        name, 
        description,
        system_type,
        base_url,
        is_active,
        is_verified,
        last_tested_at,
        created_at,
        updated_at
       FROM external_connections
       ORDER BY is_active DESC, created_at DESC`,
      []
    );

    // Add masked credentials for display
    const connections = result.rows.map((conn) => ({
      ...conn,
      api_key_masked: 'sk_****',
      api_secret_masked: 'ss_****',
    }));

    return NextResponse.json({
      success: true,
      data: connections,
      count: connections.length,
    });
  } catch (error) {
    console.error('[Integrations] GET connections error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations/connections
 * 
 * Create a new external connection
 * 
 * Body:
 * {
 *   name: string,
 *   description?: string,
 *   system_type: 'drais' | 'other',
 *   base_url: string,
 *   api_key: string,
 *   api_secret: string,
 *   is_active?: boolean
 * }
 */
export async function POST(request) {
  const perm = await requirePermission(request, 'integrations.create');
  if (perm instanceof NextResponse) return perm;

  try {
    const { auth } = perm;
    const body = await request.json();

    const { name, description, system_type = 'drais', base_url, api_key, api_secret, is_active = false } = body;

    // Validation
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Connection name is required' },
        { status: 400 }
      );
    }

    if (!base_url || typeof base_url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Base URL is required' },
        { status: 400 }
      );
    }

    if (!api_key || typeof api_key !== 'string') {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      );
    }

    if (!api_secret || typeof api_secret !== 'string') {
      return NextResponse.json(
        { success: false, error: 'API secret is required' },
        { status: 400 }
      );
    }

    // Encrypt credentials
    let api_key_encrypted, api_secret_encrypted;
    
    try {
      api_key_encrypted = encryptSecret(api_key);
      api_secret_encrypted = encryptSecret(api_secret);
    } catch (err) {
      console.error('[Integrations] Encryption error:', err);
      return NextResponse.json(
        { success: false, error: 'Failed to encrypt credentials' },
        { status: 500 }
      );
    }

    // Validate base_url is a valid URL
    try {
      new URL(base_url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid base URL format' },
        { status: 400 }
      );
    }

    // If activating this connection, deactivate others
    if (is_active) {
      await query(
        'UPDATE external_connections SET is_active = FALSE WHERE system_type = $1',
        [system_type]
      );
    }

    // Create connection
    const sql = `
      INSERT INTO external_connections 
      (name, description, system_type, base_url, api_key_encrypted, api_secret_encrypted, is_active, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, system_type, base_url, is_active, is_verified, created_at
    `;

    const insertResult = await query(sql, [
      name,
      description || null,
      system_type,
      base_url,
      api_key_encrypted,
      api_secret_encrypted,
      is_active,
      auth.userId,
    ]);

    const connection = insertResult.rows[0];

    // Log event
    try {
      await dispatch({
        type: 'CONNECTION_CREATED',
        userId: auth.userId,
        metadata: {
          connection_id: connection.id,
          connection_name: connection.name,
          system_type: connection.system_type,
        },
      });
    } catch (logErr) {
      console.warn('[Integrations] Failed to log connection creation:', logErr);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...connection,
          api_key_masked: maskCredential(api_key),
          api_secret_masked: maskCredential(api_secret),
        },
        message: `Connection "${name}" created successfully`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Integrations] POST connections error:', error);

    // Handle duplicate connection name
    if (error.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'Connection name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create connection' },
      { status: 500 }
    );
  }
}
