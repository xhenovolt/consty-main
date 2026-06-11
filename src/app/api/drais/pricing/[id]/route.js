/**
 * PATCH /api/drais/pricing/[id]
 * DELETE /api/drais/pricing/[id]
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';
import { dispatch } from '@/lib/system-events.js';

/**
 * PATCH /api/drais/pricing/[id]
 * Update pricing configuration
 */
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'drais.edit');
  if (perm instanceof NextResponse) return perm;

  try {
    const { auth } = perm;
    const { id } = params;
    const body = await request.json();
    const { price, features, description, is_active } = body;

    // Fetch current pricing config
    const currentResult = await query(
      'SELECT * FROM drais_pricing_config WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Pricing configuration not found' },
        { status: 404 }
      );
    }

    const current = currentResult.rows[0];

    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (price !== undefined) {
      updates.push(`price = $${paramCount}`);
      values.push(price);
      paramCount++;
    }

    if (features !== undefined) {
      updates.push(`features = $${paramCount}`);
      values.push(features ? JSON.stringify(features) : null);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    // Always update timestamp
    updates.push(`updated_at = NOW()`);

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    values.push(id);

    const sql = `
      UPDATE drais_pricing_config 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(sql, values);

    // Log price change if applicable
    if (price !== undefined && price !== current.price) {
      try {
        await query(
          `INSERT INTO drais_pricing_changes (pricing_config_id, old_price, new_price, changed_by)
           VALUES ($1, $2, $3, $4)`,
          [id, current.price, price, auth.userId]
        );

        await dispatch({
          type: 'DRAIS_PRICING_UPDATED',
          userId: auth.userId,
          metadata: {
            plan_name: current.plan_name,
            old_price: current.price,
            new_price: price,
          },
        });
      } catch (logError) {
        console.warn('[DRAIS Pricing] Failed to log price change:', logError);
      }
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Pricing configuration updated successfully',
    });
  } catch (error) {
    console.error('[DRAIS Pricing] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update pricing configuration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/drais/pricing/[id]
 * Soft delete pricing configuration (sets is_active to false)
 * 
 * Destructive action - requires explicit control permission
 */
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'drais.control');
  if (perm instanceof NextResponse) return perm;

  try {
    const { auth } = perm;
    const { id } = params;

    // Fetch current config
    const result = await query(
      'SELECT * FROM drais_pricing_config WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Pricing configuration not found' },
        { status: 404 }
      );
    }

    const config = result.rows[0];

    // Soft delete (deactivate)
    const updateResult = await query(
      'UPDATE drais_pricing_config SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );

    // Log deletion event
    try {
      await dispatch({
        type: 'DRAIS_PRICING_DELETED',
        userId: auth.userId,
        metadata: {
          plan_name: config.plan_name,
          price: config.price,
        },
      });
    } catch (logError) {
      console.warn('[DRAIS Pricing] Failed to log deletion event:', logError);
    }

    return NextResponse.json({
      success: true,
      data: updateResult.rows[0],
      message: `Pricing plan "${config.plan_name}" has been deactivated`,
    });
  } catch (error) {
    console.error('[DRAIS Pricing] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete pricing configuration' },
      { status: 500 }
    );
  }
}
