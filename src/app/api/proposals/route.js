import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission, buildDataScopeFilter } from '@/lib/permissions.js';

const PROPOSAL_SELECT = `
  SELECT
    pr.*,
    p.company_name  AS prospect_name,
    p.email         AS prospect_email,
    p.contact_name  AS prospect_contact,
    p.phone         AS prospect_phone,
    ds.name         AS system_name,
    ds.positioning  AS system_positioning,
    ds.description  AS system_description,
    pp.name         AS plan_name,
    pp.installation_fee,
    pp.annual_subscription,
    pp.student_limit,
    pp.is_popular,
    u.full_name     AS created_by_name
  FROM proposals pr
  JOIN prospects   p  ON p.id  = pr.prospect_id
  JOIN drais_systems ds ON ds.id = pr.system_id
  JOIN pricing_plans pp ON pp.id = pr.selected_plan_id
  LEFT JOIN users u ON u.id = pr.created_by
`;

/**
 * GET /api/proposals
 * List all proposals (optionally filtered by prospect_id or status)
 */
export async function GET(request) {
  const perm = await requirePermission(request, 'prospects.view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { searchParams } = new URL(request.url);
    const prospect_id = searchParams.get('prospect_id');
    const status = searchParams.get('status');

    const params = [];
    let sql = PROPOSAL_SELECT + ' WHERE 1=1';

    if (prospect_id) { params.push(prospect_id); sql += ` AND pr.prospect_id = $${params.length}`; }
    if (status)      { params.push(status);      sql += ` AND pr.status = $${params.length}`; }

    sql += ' ORDER BY pr.created_at DESC';

    const result = await query(sql, params);

    // Attach features for each proposal's plan
    const proposals = await Promise.all(
      result.rows.map(async (row) => {
        const feats = await query(
          `SELECT * FROM pricing_features WHERE plan_id = $1 ORDER BY display_order`,
          [row.selected_plan_id]
        );
        return { ...row, features: feats.rows };
      })
    );

    return NextResponse.json({ success: true, data: proposals });
  } catch (error) {
    console.error('[Proposals] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch proposals' }, { status: 500 });
  }
}

/**
 * POST /api/proposals
 * Create a new proposal with multi-plan snapshot.
 * Accepts selected_plan_ids[] + recommended_plan_id (new) OR selected_plan_id (compat).
 */
export async function POST(request) {
  const perm = await requirePermission(request, 'prospects.view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const body = await request.json();
    const {
      prospect_id,
      system_id,
      // Multi-plan (new)
      selected_plan_ids,
      recommended_plan_id,
      // Compat (old single-plan)
      selected_plan_id,
      // Form fields
      custom_notes,
      discount_percent,
      payment_terms,
      student_count,
      school_type,
    } = body;

    // Normalise plan IDs — support both old and new format
    const planIds = Array.isArray(selected_plan_ids) && selected_plan_ids.length
      ? selected_plan_ids
      : selected_plan_id ? [selected_plan_id] : [];

    const recPlanId = recommended_plan_id || planIds[0] || null;

    if (!prospect_id || !system_id || !planIds.length) {
      return NextResponse.json(
        { success: false, error: 'prospect_id, system_id, and at least one plan are required' },
        { status: 400 }
      );
    }

    // Validate prospect exists
    const prospectRes = await query(`SELECT * FROM prospects WHERE id = $1`, [prospect_id]);
    if (!prospectRes.rows[0]) {
      return NextResponse.json({ success: false, error: 'Prospect not found' }, { status: 404 });
    }

    // Validate all plans exist and belong to the system
    const plansRes = await query(
      `SELECT pp.*, ds.name AS system_name, ds.positioning, ds.description AS system_description,
              ds.comparison_matrix,
              sec.problem_block, sec.solution_block, sec.why_attendance_first,
              sec.cost_of_inaction_block, sec.transformation_block
       FROM pricing_plans pp
       JOIN drais_systems ds ON ds.id = pp.system_id
       LEFT JOIN systems_extended_content sec ON sec.system_id = ds.id
       WHERE pp.id = ANY($1::uuid[]) AND pp.system_id = $2`,
      [planIds, system_id]
    );
    if (plansRes.rows.length !== planIds.length) {
      return NextResponse.json(
        { success: false, error: 'One or more plans not found or do not belong to the specified system' },
        { status: 404 }
      );
    }

    // Fetch features for all plans
    const featuresRes = await query(
      `SELECT * FROM pricing_features WHERE plan_id = ANY($1::uuid[]) ORDER BY plan_id, display_order`,
      [planIds]
    );
    const featuresByPlan = {};
    for (const f of featuresRes.rows) {
      if (!featuresByPlan[f.plan_id]) featuresByPlan[f.plan_id] = [];
      featuresByPlan[f.plan_id].push(f);
    }

    const sysRow = plansRes.rows[0]; // system data same across all rows
    const recPlan = plansRes.rows.find(p => p.id === recPlanId) || plansRes.rows[0];

    // Create the proposal — selected_plan_id = recommended plan (for FK compat)
    const proposalRes = await query(
      `INSERT INTO proposals
         (prospect_id, system_id, selected_plan_id, selected_plan_ids, recommended_plan_id,
          custom_notes, discount_percent, payment_terms, student_count, school_type,
          status, created_by)
       VALUES ($1, $2, $3, $4::uuid[], $5, $6, $7, $8, $9, $10, 'generated', $11)
       RETURNING *`,
      [
        prospect_id, system_id, recPlan.id, planIds, recPlanId,
        custom_notes || null, parseFloat(discount_percent) || 0, payment_terms || null,
        student_count ? parseInt(student_count) : null, school_type || null,
        auth.userId,
      ]
    );
    const proposal = proposalRes.rows[0];
    const prospect = prospectRes.rows[0];

    // Build full multi-plan snapshot
    const plans = plansRes.rows.map(p => ({
      id: p.id,
      name: p.name,
      installation_fee:    parseFloat(p.installation_fee),
      annual_subscription: parseFloat(p.annual_subscription),
      student_limit:       p.student_limit,
      is_popular:          p.is_popular,
      is_recommended:      p.id === recPlanId,
      features:            featuresByPlan[p.id] || [],
    }));

    const discPct = parseFloat(discount_percent || 0);
    const snapshot = {
      proposal_id:      proposal.id,
      generated_at:     new Date().toISOString(),
      school_name:      prospect.company_name,
      contact_name:     prospect.contact_name,
      email:            prospect.email,
      phone:            prospect.phone,
      student_count:    student_count || null,
      school_type:      school_type || null,
      system: {
        id:          system_id,
        name:        sysRow.system_name,
        positioning: sysRow.positioning,
        description: sysRow.system_description,
      },
      extended_content: {
        problem_block:          sysRow.problem_block          || '',
        solution_block:         sysRow.solution_block         || '',
        why_attendance_first:   sysRow.why_attendance_first   || '',
        cost_of_inaction_block: sysRow.cost_of_inaction_block || '',
        transformation_block:   sysRow.transformation_block   || '',
      },
      comparison_matrix:    sysRow.comparison_matrix || [],
      plans,
      recommended_plan_id:  recPlanId,
      discount_percent:     discPct,
      custom_notes:         custom_notes || null,
      payment_terms:        payment_terms || null,
    };

    // Save snapshot
    await query(
      `INSERT INTO proposal_snapshots (proposal_id, full_payload) VALUES ($1, $2)`,
      [proposal.id, JSON.stringify(snapshot)]
    );

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'CREATE', 'proposal', $2, $3)`,
      [auth.userId, proposal.id, JSON.stringify({ prospect_id, plans: plans.map(p => p.name) })]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      data: { ...proposal, snapshot, plans, prospect },
    }, { status: 201 });
  } catch (error) {
    console.error('[Proposals] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create proposal' }, { status: 500 });
  }
}
