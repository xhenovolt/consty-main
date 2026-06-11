import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';

// GET /api/pricing — list all plans (admin/internal, all systems)
export async function GET(request) {
  const perm = await requirePermission(request, 'pricing.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { searchParams } = new URL(request.url);
    const system   = searchParams.get('system');
    const active   = searchParams.get('active'); // 'true'|'false'|null (all)
    const page     = Math.max(1, parseInt(searchParams.get('page')  || '1'));
    const limit    = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset   = (page - 1) * limit;

    const params = [];
    let where = 'WHERE 1=1';

    if (system) { params.push(system.toLowerCase()); where += ` AND pp.system = $${params.length}`; }
    if (active !== null && active !== undefined) {
      params.push(active === 'true');
      where += ` AND pp.is_active = $${params.length}`;
    }

    const sql = `
      SELECT
        pp.id, pp.name, pp.system, pp.description, pp.features,
        pp.is_active, pp.display_order, pp.created_at, pp.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id',            pc.id,
              'name',          pc.name,
              'duration_days', pc.duration_days,
              'price',         pc.price,
              'currency',      pc.currency,
              'is_active',     pc.is_active
            ) ORDER BY pc.duration_days
          ) FILTER (WHERE pc.id IS NOT NULL),
          '[]'
        ) AS pricing_cycles
      FROM pricing_plans pp
      LEFT JOIN pricing_cycles pc ON pc.plan_id = pp.id
      ${where}
      GROUP BY pp.id
      ORDER BY pp.system, pp.display_order, pp.name
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countSql = `SELECT COUNT(*) FROM pricing_plans pp ${where}`;

    const [result, countResult] = await Promise.all([
      query(sql, [...params, limit, offset]),
      query(countSql, params),
    ]);

    const total = parseInt(countResult.rows[0].count);
    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[Pricing] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch pricing plans' }, { status: 500 });
  }
}

// POST /api/pricing — create a new plan
export async function POST(request) {
  const perm = await requirePermission(request, 'pricing.create');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const body = await request.json();
    const { name, system, description, features, display_order } = body;

    if (!name)   return NextResponse.json({ success: false, error: 'name is required' },   { status: 400 });
    if (!system) return NextResponse.json({ success: false, error: 'system is required' }, { status: 400 });

    const result = await query(
      `INSERT INTO pricing_plans (name, system, description, features, display_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name,
        system.toLowerCase(),
        description || null,
        JSON.stringify(features || []),
        display_order ?? 0,
        auth.userId,
      ]
    );

    await dispatch('pricing.plan_created', {
      planId: result.rows[0].id,
      name,
      system: system.toLowerCase(),
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'A plan with that name already exists for this system' }, { status: 409 });
    }
    console.error('[Pricing] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create pricing plan' }, { status: 500 });
  }
}
