import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';
import { findOrLinkResource, refreshResourceFromLine } from '@/lib/procurement-resource-sync.js';

const INSPECTION = ['pending', 'accepted', 'partially_accepted', 'rejected'];

function lineStatus(quantity, received, rejected) {
  if (received + rejected >= quantity) return received > 0 ? 'fully_received' : 'rejected';
  if (received > 0 || rejected > 0) return 'partially_received';
  return 'ordered';
}

// GET — receipts with their line breakdown
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { id, prid } = await params;
  const gate = await assertProjectAccess(perm.auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  const { rows } = await query(
    `SELECT g.*, u.name AS received_by_name,
            (SELECT json_agg(json_build_object('item', l.item_name, 'received', grl.quantity_received,
               'rejected', grl.quantity_rejected, 'inspection', grl.inspection_status))
             FROM goods_receipt_lines grl JOIN procurement_request_lines l ON l.id = grl.procurement_line_item_id
             WHERE grl.goods_receipt_id = g.id) AS lines
     FROM goods_receipts g LEFT JOIN users u ON u.id = g.received_by
     WHERE g.procurement_request_id = $1 ORDER BY g.received_at DESC`, [prid]);
  return NextResponse.json({ success: true, data: rows });
}

// POST — record a (partial) goods receipt across one or more line items
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id, prid } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const pr = (await query(`SELECT id, title, currency, status, supplier_id FROM procurement_requests WHERE id=$1 AND project_id=$2`, [prid, id])).rows[0];
    if (!pr) return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    if (['closed', 'rejected', 'cancelled'].includes(pr.status)) return NextResponse.json({ success: false, error: `Cannot receive against a ${pr.status} request` }, { status: 400 });

    const b = await request.json();
    const inLines = Array.isArray(b.lines) ? b.lines.filter(l => l && l.line_item_id && (Number(l.quantity_received) > 0 || Number(l.quantity_rejected) > 0)) : [];
    if (inLines.length === 0) return NextResponse.json({ success: false, error: 'Provide at least one line with a received or rejected quantity' }, { status: 400 });

    // Load the affected procurement lines and validate against remaining qty.
    const lineIds = inLines.map(l => l.line_item_id);
    const dbLines = (await query(
      `SELECT * FROM procurement_request_lines WHERE id = ANY($1::uuid[]) AND request_id = $2`, [lineIds, prid])).rows;
    const byId = Object.fromEntries(dbLines.map(l => [l.id, l]));
    for (const rl of inLines) {
      const l = byId[rl.line_item_id];
      if (!l) return NextResponse.json({ success: false, error: 'Line item not in this request' }, { status: 400 });
      const qr = Number(rl.quantity_received) || 0, qj = Number(rl.quantity_rejected) || 0;
      if (qr < 0 || qj < 0) return NextResponse.json({ success: false, error: 'Quantities cannot be negative' }, { status: 400 });
      if (qr + qj > Number(l.remaining_quantity)) {
        return NextResponse.json({ success: false, error: `Over-receipt on "${l.item_name}": only ${l.remaining_quantity} remaining` }, { status: 400 });
      }
    }

    // Resolve an account for the actual-spend expenses (company ledger requires
    // it). Prefer a project funding account → any account → auto-provision one
    // so received value is always captured as actual spend.
    let accountId = (await query(`SELECT account_id FROM funding_sources WHERE project_id=$1 AND account_id IS NOT NULL ORDER BY created_at LIMIT 1`, [id])).rows[0]?.account_id
      || (await query(`SELECT id FROM accounts ORDER BY created_at LIMIT 1`)).rows[0]?.id || null;
    if (!accountId) accountId = (await query(`INSERT INTO accounts (name, type) VALUES ('Project Cash','cash') RETURNING id`)).rows[0].id;

    // Header
    const receipt = (await query(
      `INSERT INTO goods_receipts (procurement_request_id, project_id, supplier_id, received_by, delivery_note_number, notes, received_at)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,now()) RETURNING *`,
      [prid, id, b.supplier_id || pr.supplier_id || null, auth.userId, b.delivery_note_number || null, b.notes || null])).rows[0];

    for (const rl of inLines) {
      const l = byId[rl.line_item_id];
      const qr = Number(rl.quantity_received) || 0, qj = Number(rl.quantity_rejected) || 0;
      const unitCost = rl.actual_unit_cost != null ? Number(rl.actual_unit_cost) : Number(l.est_unit_cost);
      const insp = INSPECTION.includes(rl.inspection_status) ? rl.inspection_status : (qj > 0 ? (qr > 0 ? 'partially_accepted' : 'rejected') : 'accepted');

      await query(
        `INSERT INTO goods_receipt_lines (goods_receipt_id, procurement_line_item_id, quantity_received, quantity_rejected, actual_unit_cost, storage_location, inspection_status, rejection_reason)
         VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8)`,
        [receipt.id, l.id, qr, qj, rl.actual_unit_cost ?? null, rl.storage_location || null, insp, rl.rejection_reason || null]);

      const newReceived = Number(l.received_quantity) + qr;
      const newRejected = Number(l.rejected_quantity) + qj;
      const lStatus = lineStatus(Number(l.quantity), newReceived, newRejected);
      await query(
        `UPDATE procurement_request_lines SET received_quantity=$1, rejected_quantity=$2, actual_unit_cost=COALESCE($3, actual_unit_cost), status=$4
         WHERE id=$5`, [newReceived, newRejected, rl.actual_unit_cost ?? null, lStatus, l.id]);

      // Sync into a project resource — grouping with any same catalog/name row
      // (manual or procured), creating one if none exists. Received qty adds to
      // available; incoming/rejected/status are refreshed from the line.
      const resId = await findOrLinkResource(id, l, auth.userId);
      await query(
        `UPDATE resources SET quantity_available = quantity_available + $1,
           storage_location = COALESCE($2, storage_location), updated_at = now() WHERE id = $3`,
        [qr, rl.storage_location || null, resId]);
      await refreshResourceFromLine(resId, { ...l, received_quantity: newReceived, rejected_quantity: newRejected });

      // Budget: convert only the accepted received value into actual spend.
      const acceptedValue = qr * unitCost;
      if (acceptedValue > 0 && accountId) {
        await query(
          `INSERT INTO expenses (project_id, account_id, amount, currency, category, description, status, created_by)
           VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,'paid',$7::uuid)`,
          [id, accountId, acceptedValue, pr.currency, l.budget_category || 'other',
           `Goods received: ${l.item_name}`, auth.userId]);
      }
    }

    // Remaining commitment per category = value of not-yet-received approved lines.
    await query(
      `UPDATE commitments c SET amount = sub.val, status = CASE WHEN sub.val <= 0 THEN 'settled' ELSE 'open' END, updated_at=now()
       FROM (SELECT COALESCE(budget_category,'other') bc, SUM(remaining_quantity * est_unit_cost) val
             FROM procurement_request_lines WHERE request_id=$1 GROUP BY COALESCE(budget_category,'other')) sub
       WHERE c.procurement_request_id=$1 AND COALESCE(c.budget_category,'other') = sub.bc`, [prid]);

    // Roll the request status up from its lines.
    const agg = (await query(
      `SELECT count(*)::int total,
              count(*) FILTER (WHERE status IN ('fully_received','cancelled','rejected'))::int done,
              count(*) FILTER (WHERE received_quantity>0 OR rejected_quantity>0)::int touched
       FROM procurement_request_lines WHERE request_id=$1`, [prid])).rows[0];
    const reqStatus = agg.total > 0 && agg.done === agg.total ? 'fully_received' : (agg.touched > 0 ? 'partially_received' : pr.status);
    await query(`UPDATE procurement_requests SET status=$1, updated_at=now() WHERE id=$2`, [reqStatus, prid]);

    await query(`SELECT fn_recompute_budget($1)`, [id]).catch(() => {});
    return NextResponse.json({ success: true, data: { receipt, request_status: reqStatus } }, { status: 201 });
  } catch (error) {
    console.error('[GoodsReceipt] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to record receipt' }, { status: 500 });
  }
}
