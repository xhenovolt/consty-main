import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/capital-allocation — Get rules and current allocation state
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'finance.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const rules = await query(`SELECT * FROM capital_allocation_rules WHERE is_active = true ORDER BY percentage DESC`);

    // Get total revenue and allocated amounts per category
    const summary = await query(`
      SELECT 
        ra.category,
        COUNT(ra.id) as allocation_count,
        COALESCE(SUM(ra.amount), 0) as total_allocated,
        COALESCE(SUM(ra.amount) FILTER (WHERE re.date_received >= date_trunc('month', CURRENT_DATE)), 0) as this_month,
        COALESCE(SUM(ra.amount) FILTER (WHERE re.date_received >= date_trunc('year', CURRENT_DATE)), 0) as this_year
      FROM revenue_allocations ra
      LEFT JOIN revenue_events re ON ra.revenue_event_id = re.id
      GROUP BY ra.category
    `);

    const totalRevenue = await query(`SELECT COALESCE(SUM(amount), 0) as total FROM revenue_events`);

    return NextResponse.json({
      success: true,
      data: {
        rules: rules.rows,
        allocations: summary.rows,
        total_revenue: totalRevenue.rows[0].total,
      },
    });
  } catch (error) {
    console.error('[CapitalAllocation] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: 500 });
  }
}

// POST /api/capital-allocation — Create or update rule
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'finance.create');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { rule_name, percentage, category, description } = body;
    if (!rule_name || percentage === undefined || !category) {
      return NextResponse.json({ success: false, error: 'rule_name, percentage, category required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO capital_allocation_rules (rule_name, percentage, category, description) VALUES ($1,$2,$3,$4) RETURNING *`,
      [rule_name, percentage, category, description || null]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create rule' }, { status: 500 });
  }
}

// PUT /api/capital-allocation — Update rule
export async function PUT(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { id, rule_name, percentage, category, is_active, description } = body;
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    const fields = [];
    const values = [];
    let idx = 1;
    if (rule_name) { fields.push(`rule_name = $${idx++}`); values.push(rule_name); }
    if (percentage !== undefined) { fields.push(`percentage = $${idx++}`); values.push(percentage); }
    if (category) { fields.push(`category = $${idx++}`); values.push(category); }
    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    fields.push(`updated_at = NOW()`);

    values.push(id);
    const result = await query(`UPDATE capital_allocation_rules SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update rule' }, { status: 500 });
  }
}
