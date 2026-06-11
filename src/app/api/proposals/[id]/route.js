import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

async function fetchProposal(id) {
  const res = await query(
    `SELECT
       pr.*,
       p.company_name  AS prospect_name,
       p.email         AS prospect_email,
       p.contact_name  AS prospect_contact,
       p.phone         AS prospect_phone,
       p.website       AS prospect_website,
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
     JOIN prospects     p  ON p.id  = pr.prospect_id
     JOIN drais_systems ds ON ds.id = pr.system_id
     JOIN pricing_plans pp ON pp.id = pr.selected_plan_id
     LEFT JOIN users    u  ON u.id  = pr.created_by
     WHERE pr.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

/**
 * GET /api/proposals/[id]
 */
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'prospects.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const proposal = await fetchProposal(id);
    if (!proposal) return NextResponse.json({ success: false, error: 'Proposal not found' }, { status: 404 });

    const [featuresRes, snapshotRes] = await Promise.all([
      query(`SELECT * FROM pricing_features WHERE plan_id = $1 ORDER BY display_order`, [proposal.selected_plan_id]),
      query(`SELECT * FROM proposal_snapshots WHERE proposal_id = $1 ORDER BY created_at DESC LIMIT 1`, [id]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...proposal,
        features:  featuresRes.rows,
        snapshot:  snapshotRes.rows[0]?.full_payload || null,
      },
    });
  } catch (error) {
    console.error('[Proposals] GET[id] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch proposal' }, { status: 500 });
  }
}

/**
 * PATCH /api/proposals/[id]
 * Update status, custom_notes, discount_percent, payment_terms
 */
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'prospects.view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const { status, custom_notes, discount_percent, payment_terms } = await request.json();

    const VALID_STATUSES = ['draft', 'generated', 'sent', 'accepted', 'rejected'];
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    const fields = [];
    const values = [];
    if (status         !== undefined) { values.push(status);          fields.push(`status = $${values.length}`); }
    if (custom_notes   !== undefined) { values.push(custom_notes);    fields.push(`custom_notes = $${values.length}`); }
    if (discount_percent !== undefined) { values.push(discount_percent); fields.push(`discount_percent = $${values.length}`); }
    if (payment_terms  !== undefined) { values.push(payment_terms);   fields.push(`payment_terms = $${values.length}`); }

    if (!fields.length) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    const result = await query(
      `UPDATE proposals SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Proposal not found' }, { status: 404 });

    const proposal = await fetchProposal(id);
    return NextResponse.json({ success: true, data: proposal });
  } catch (error) {
    console.error('[Proposals] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update proposal' }, { status: 500 });
  }
}

/**
 * DELETE /api/proposals/[id]
 */
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'prospects.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const result = await query(`DELETE FROM proposals WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Proposal not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Proposals] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete proposal' }, { status: 500 });
  }
}
