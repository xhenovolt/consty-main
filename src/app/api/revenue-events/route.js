import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/revenue-events — List revenue events
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'finance.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const source_type = searchParams.get('source_type');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');

    let sql = `SELECT re.*, 
               COALESCE(json_agg(json_build_object('category', ra.category, 'amount', ra.amount)) 
               FILTER (WHERE ra.id IS NOT NULL), '[]') as allocations
               FROM revenue_events re
               LEFT JOIN revenue_allocations ra ON ra.revenue_event_id = re.id
               WHERE 1=1`;
    const params = [];
    if (source_type) { params.push(source_type); sql += ` AND re.source_type = $${params.length}`; }
    if (date_from) { params.push(date_from); sql += ` AND re.date_received >= $${params.length}`; }
    if (date_to) { params.push(date_to); sql += ` AND re.date_received <= $${params.length}`; }
    sql += ` GROUP BY re.id ORDER BY re.date_received DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[RevenueEvents] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: 500 });
  }
}

// POST /api/revenue-events — Record revenue and auto-allocate
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'finance.create');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { source_type, source_id, amount, currency, received_account, date_received, description } = body;
    if (!amount || !source_type) return NextResponse.json({ success: false, error: 'amount and source_type required' }, { status: 400 });

    // Create revenue event
    const rev = await query(
      `INSERT INTO revenue_events (source_type, source_id, amount, currency, received_account, date_received, description, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [source_type, source_id || null, amount, currency || 'UGX', received_account || null, date_received || new Date().toISOString().split('T')[0], description || null, auth.userId]
    );

    const revenueEvent = rev.rows[0];

    // Auto-allocate based on active rules
    const rules = await query(`SELECT * FROM capital_allocation_rules WHERE is_active = true`);
    const allocations = [];

    for (const rule of rules.rows) {
      const allocAmount = (parseFloat(amount) * parseFloat(rule.percentage) / 100).toFixed(2);
      const alloc = await query(
        `INSERT INTO revenue_allocations (revenue_event_id, rule_id, category, amount, currency) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [revenueEvent.id, rule.id, rule.category, allocAmount, currency || 'UGX']
      );
      allocations.push(alloc.rows[0]);
    }

    // Mark as allocated
    await query(`UPDATE revenue_events SET allocated = true WHERE id = $1`, [revenueEvent.id]);

    return NextResponse.json({ success: true, data: { ...revenueEvent, allocations } }, { status: 201 });
  } catch (error) {
    console.error('[RevenueEvents] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to record revenue' }, { status: 500 });
  }
}
