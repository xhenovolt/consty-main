import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';

/**
 * PUBLIC Pricing API — No authentication required.
 *
 * GET /api/pricing/system/[system]
 *
 * Returns ALL active plans and their active cycles for the requested system.
 * This is the endpoint that external systems (Drais, Lypha, etc.) MUST call.
 *
 * RULES (enforced here):
 *  - Only active plans returned (is_active = TRUE)
 *  - Only active cycles returned (is_active = TRUE)
 *  - No hardcoded pricing is ever returned — all data comes from DB
 *  - Cache-Control header allows CDN caching for 60 seconds
 *
 * Error handling (Section 11):
 *  - On DB failure the response shape still uses { available: false }
 *    so calling systems can display "Pricing temporarily unavailable"
 */
export async function GET(request, { params }) {
  const { system } = await params;

  if (!system || !/^[a-zA-Z0-9_-]+$/.test(system)) {
    return NextResponse.json(
      { available: false, error: 'Invalid system identifier' },
      { status: 400 }
    );
  }

  try {
    const result = await query(
      `SELECT
         pp.id,
         pp.name,
         pp.system,
         pp.description,
         pp.features,
         pp.display_order,
         COALESCE(
           json_agg(
             json_build_object(
               'id',            pc.id,
               'name',          pc.name,
               'duration_days', pc.duration_days,
               'price',         pc.price,
               'currency',      pc.currency
             ) ORDER BY pc.duration_days
           ) FILTER (WHERE pc.id IS NOT NULL AND pc.is_active = TRUE),
           '[]'
         ) AS pricing_cycles
       FROM pricing_plans pp
       LEFT JOIN pricing_cycles pc ON pc.plan_id = pp.id
       WHERE pp.system = $1
         AND pp.is_active = TRUE
       GROUP BY pp.id
       ORDER BY pp.display_order, pp.name`,
      [system.toLowerCase()]
    );

    // Determine the primary currency for this system (uses first cycle found)
    let currency = 'UGX';
    for (const plan of result.rows) {
      if (plan.pricing_cycles?.length > 0) {
        currency = plan.pricing_cycles[0].currency;
        break;
      }
    }

    const response = NextResponse.json({
      available: true,
      system: system.toLowerCase(),
      currency,
      plans: result.rows,
      fetched_at: new Date().toISOString(),
    });

    // Allow CDN / reverse-proxy caching for 60 seconds, stale-while-revalidate 30 s
    response.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    return response;
  } catch (error) {
    console.error(`[PublicPricing] GET /api/pricing/system/${system} error:`, error);

    // Section 11: On failure, return available:false — do NOT fall back to hardcoded prices
    return NextResponse.json(
      {
        available: false,
        system: system.toLowerCase(),
        error: 'Pricing temporarily unavailable',
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
