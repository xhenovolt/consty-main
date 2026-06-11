/**
 * PATCH /api/integrations/connections/[id]
 * DELETE /api/integrations/connections/[id]
 * POST /api/integrations/connections/[id]/activate
 * 
 * Individual connection operations
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';
import { encryptSecret, maskCredential, decryptSecret } from '@/lib/encryption.js';
import { dispatch } from '@/lib/system-events.js';

/**
 * PATCH /api/integrations/connections/[id]
 * 
 * Update a connection
 */
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'integrations.edit');
  if (perm instanceof NextResponse) return perm;

  try {
    const { auth } = perm;
    const { id } = params;
    const body = await request.json();

    const { name, description, base_url, api_key, api_secret, is_active } = body;

    // Fetch current connection
    const currentResult = await query(
      'SELECT * FROM external_connections WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Connection not found' },
        { status: 404 }
      );
    }

    const current = currentResult.rows[0];

    // Build update
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }

    if (base_url !== undefined) {
      try {
        new URL(base_url);
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid base URL format' },
          { status: 400 }
        );
      }
      updates.push(`base_url = $${paramCount}`);
      values.push(base_url);
      paramCount++;
    }

    if (api_key !== undefined) {
      const encrypted = encryptSecret(api_key);
      updates.push(`api_key_encrypted = $${paramCount}`);
      values.push(encrypted);
      paramCount++;
    }

    if (api_secret !== undefined) {
      const encrypted = encryptSecret(api_secret);
      updates.push(`api_secret_encrypted = $${paramCount}`);
      values.push(encrypted);
      paramCount++;
    }

    if (is_active !== undefined) {
      // If activating, deactivate others
      if (is_active) {
        await query(
          'UPDATE external_connections SET is_active = FALSE WHERE system_type = $1 AND id != $2',
          [current.system_type, id]
        );
      }
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    values.push(id);

    const sql = `
      UPDATE external_connections
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, system_type, base_url, is_active, is_verified, created_at, updated_at
    `;

    const result = await query(sql, values);
    const updated = result.rows[0];

    // Log event
    try {
      await dispatch({
        type: 'CONNECTION_UPDATED',
        userId: auth.userId,
        metadata: {
          connection_id: id,
          connection_name: current.name,
          changes: Object.keys(body).filter((k) => body[k] !== undefined),
        },
      });
    } catch (logErr) {
      console.warn('[Integrations] Failed to log connection update:', logErr);
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Connection updated successfully',
    });
  } catch (error) {
    console.error('[Integrations] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update connection' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/connections/[id]
 * 
 * Delete a connection
 */
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'integrations.delete');
  if (perm instanceof NextResponse) return perm;

  try {
    const { auth } = perm;
    const { id } = params;

    // Fetch connection
    const result = await query(
      'SELECT * FROM external_connections WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Connection not found' },
        { status: 404 }
      );
    }

    const connection = result.rows[0];

    // Delete
    await query('DELETE FROM external_connections WHERE id = $1', [id]);

    // If this was active, deactivate it
    if (connection.is_active) {
      await query(
        'UPDATE external_connections SET is_active = TRUE WHERE system_type = $1 LIMIT 1',
        [connection.system_type]
      );
    }

    // Log event
    try {
      await dispatch({
        type: 'CONNECTION_DELETED',
        userId: auth.userId,
        metadata: {
          connection_id: id,
          connection_name: connection.name,
          system_type: connection.system_type,
        },
      });
    } catch (logErr) {
      console.warn('[Integrations] Failed to log connection deletion:', logErr);
    }

    return NextResponse.json({
      success: true,
      message: `Connection "${connection.name}" deleted`,
    });
  } catch (error) {
    console.error('[Integrations] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete connection' },
      { status: 500 }
    );
  }
}
