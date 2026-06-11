import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * GET /api/drais/systems
 * Returns all DRAIS systems with plans, features, extended content, and comparison matrix.
 */
export async function GET(request) {
  const perm = await requirePermission(request, 'prospects.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const systemsResult = await query(`
      SELECT ds.*,
             sec.problem_block,
             sec.solution_block,
             sec.why_attendance_first,
             sec.cost_of_inaction_block,
             sec.transformation_block
      FROM drais_systems ds
      LEFT JOIN systems_extended_content sec ON sec.system_id = ds.id
      WHERE ds.is_active = TRUE
      ORDER BY ds.name
    `);

    const systems = await Promise.all(
      systemsResult.rows.map(async (sys) => {
        const plansResult = await query(`
          SELECT pp.*,
            COALESCE(
              json_agg(pf ORDER BY pf.display_order) FILTER (WHERE pf.id IS NOT NULL),
              '[]'
            ) AS features
          FROM pricing_plans pp
          LEFT JOIN pricing_features pf ON pf.plan_id = pp.id
          WHERE pp.system_id = $1 AND pp.is_active = TRUE
          GROUP BY pp.id
          ORDER BY pp.display_order
        `, [sys.id]);

        return { ...sys, plans: plansResult.rows };
      })
    );

    return NextResponse.json({ success: true, data: systems });
  } catch (error) {
    console.error('[DRAIS Systems] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch systems' }, { status: 500 });
  }
}
