import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';
import { findOrLinkResource, refreshResourceFromLine } from '@/lib/procurement-resource-sync.js';

const STATUSES = ['requested','approved','ordered','received','inspected','stored','allocated','closed','rejected'];

// GET /api/projects/[id]/procurement/[prid] — request + lines + receipts
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { id, prid } = await params;
  const gate = await assertProjectAccess(perm.auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  const [pr, lines, receipts] = await Promise.all([
    query(`SELECT pr.*, s.name AS supplier_name FROM procurement_requests pr
           LEFT JOIN suppliers s ON s.id = pr.supplier_id WHERE pr.id = $1 AND pr.project_id = $2`, [prid, id]),
    query(`SELECT l.*, r.name AS resource_name FROM procurement_request_lines l
           LEFT JOIN resources r ON r.id = l.resource_id WHERE l.request_id = $1 ORDER BY l.created_at`, [prid]),
    query(`SELECT g.*, COALESCE(rb.name, ib.name) AS received_by_name FROM goods_receipts g
           LEFT JOIN users rb ON rb.id = g.received_by
           LEFT JOIN users ib ON ib.id = g.inspected_by
           WHERE g.procurement_request_id = $1 ORDER BY g.received_at DESC`, [prid]),
  ]);
  if (!pr.rows[0]) return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: { ...pr.rows[0], lines: lines.rows, receipts: receipts.rows } });
}

// PATCH /api/projects/[id]/procurement/[prid] — advance status (+ budget commitment side-effects)
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id, prid } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const b = await request.json();
    const cur = (await query(`SELECT * FROM procurement_requests WHERE id=$1 AND project_id=$2`, [prid, id])).rows[0];
    if (!cur) return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });

    const sets = [], values = [];
    if (b.status != null) {
      if (!STATUSES.includes(b.status)) return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
      values.push(b.status); sets.push(`status = $${values.length}`);
      if (b.status === 'approved') { values.push(auth.userId); sets.push(`approved_by = $${values.length}::uuid`); sets.push(`approved_at = now()`); }
    }
    for (const k of ['title','description','supplier_id','needed_by','notes','total_est_cost']) {
      if (k in b) { values.push(b[k]); sets.push(`${k} = $${values.length}`); }
    }
    if (sets.length === 0) return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    values.push(prid); values.push(id);
    const { rows } = await query(
      `UPDATE procurement_requests SET ${sets.join(', ')}, updated_at = now()
        WHERE id = $${values.length - 1} AND project_id = $${values.length} RETURNING *`, values);
    const pr = rows[0];

    // Budget side-effects: commitments are the bridge into the project budget,
    // created PER budget category from the request's line items.
    if (b.status && b.status !== cur.status) {
      const have = (await query(`SELECT count(*)::int n FROM commitments WHERE procurement_request_id=$1`, [prid])).rows[0].n;
      if (b.status === 'approved' && have === 0) {
        // One commitment per budget category, summing that category's line totals.
        await query(
          `INSERT INTO commitments (project_id, work_item_id, procurement_request_id, amount, currency, status, budget_category, created_by)
           SELECT $1::uuid, $2::uuid, $3::uuid,
                  COALESCE(SUM(l.est_total),0), $4,
                  'open', COALESCE(l.budget_category, $5, 'other'), $6::uuid
             FROM procurement_request_lines l
            WHERE l.request_id = $3::uuid
            GROUP BY COALESCE(l.budget_category, $5, 'other')`,
          [id, pr.work_item_id || null, prid, pr.currency, pr.budget_category || null, auth.userId]);
        // Fallback: a request with no lines still reserves its header total.
        await query(
          `INSERT INTO commitments (project_id, work_item_id, procurement_request_id, amount, currency, status, budget_category, created_by)
           SELECT $1::uuid,$2::uuid,$3::uuid,$4::numeric,$5,'open',COALESCE($6,'other'),$7::uuid
           WHERE NOT EXISTS (SELECT 1 FROM commitments WHERE procurement_request_id=$3::uuid)
             AND $4::numeric > 0`,
          [id, pr.work_item_id || null, prid, pr.total_est_cost, pr.currency, pr.budget_category || null, auth.userId]);

        // Mark lines ordered and create EXPECTED project resources (one per line)
        // so the Resources tab shows incoming items before anything is received.
        await query(`UPDATE procurement_request_lines SET ordered_quantity = quantity, status='ordered'
                     WHERE request_id=$1 AND status='requested'`, [prid]);
        // Group each line into a project resource (merging same catalog/name),
        // so the Resources tab shows incoming items — no duplicate rows.
        const appLines = (await query(`SELECT * FROM procurement_request_lines WHERE request_id=$1`, [prid])).rows;
        for (const l of appLines) {
          const resId = await findOrLinkResource(id, l, auth.userId);
          await refreshResourceFromLine(resId, l);
        }
      } else if (b.status === 'closed') {
        await query(`UPDATE commitments SET status='settled', updated_at=now() WHERE procurement_request_id=$1 AND status='open'`, [prid]);
      } else if (b.status === 'rejected') {
        await query(`UPDATE commitments SET status='cancelled', updated_at=now() WHERE procurement_request_id=$1 AND status='open'`, [prid]);
      }
      // Recompute the whole budget so per-category committed/forecast update.
      await query(`SELECT fn_recompute_budget($1)`, [id]).catch(() => {});
    }
    return NextResponse.json({ success: true, data: pr });
  } catch (error) {
    console.error('[Procurement] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update request' }, { status: 500 });
  }
}
