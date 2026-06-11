/**
 * GET /api/drais/pricing
 * POST /api/drais/pricing
 * 
 * Pricing configuration endpoints
 * This is the ONLY local data storage allowed for DRAIS integration
 * DRAIS will consume these prices via the public endpoint
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';
import { dispatch } from '@/lib/system-events.js';

/**
 * GET /api/drais/pricing
 * Retrieve all active pricing configurations
 * 
 * Query parameters:
 * - include_inactive: Set to 'true' to include inactive plans
 */
export async function GET(request) {
  const perm = await requirePermission(request, 'drais.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';

    let sql = 'SELECT * FROM drais_pricing_config';
    const params = [];

    if (!includeInactive) {
      sql += ' WHERE is_active = TRUE';
    }

    sql += ' ORDER BY price ASC';

    const result = await query(sql, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('[DRAIS Pricing] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pricing configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/drais/pricing
 * Create a new pricing configuration
 * 
 * Request body:
 * {
 *   plan_name: string (required, unique)
 *   price: number (required)
 *   currency: string (default: USD)
 *   features: object (optional)
 *   description: string (optional)
 * }
 */
export async function POST(request) {
  const perm = await requirePermission(request, 'drais.edit');
  if (perm instanceof NextResponse) return perm;

  try {
    const { auth } = perm;
    const body = await request.json();
    const { plan_name, price, currency = 'USD', features, description } = body;

    // Validation
    if (!plan_name || typeof plan_name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'plan_name is required and must be a string' },
        { status: 400 }
      );
    }

    if (!price || typeof price !== 'number' || price < 0) {
      return NextResponse.json(
        { success: false, error: 'price is required and must be a positive number' },
        { status: 400 }
      );
    }

    const sql = `
      INSERT INTO drais_pricing_config (plan_name, price, currency, features, description, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await query(sql, [
      plan_name,
      price,
      currency,
      features ? JSON.stringify(features) : null,
      description,
      auth.userId,
    ]);

    // Log creation event
    try {
      await dispatch({
        type: 'DRAIS_PRICING_CREATED',
        userId: auth.userId,
        metadata: {
          plan_name,
          price,
          currency,
        },
      });
    } catch (logError) {
      console.warn('[DRAIS Pricing] Failed to log creation event:', logError);
    }

    return NextResponse.json(
      {
        success: true,
        data: result.rows[0],
        message: `Pricing plan "${plan_name}" created successfully`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[DRAIS Pricing] POST error:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'A pricing plan with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create pricing configuration' },
      { status: 500 }
    );
  }
}
