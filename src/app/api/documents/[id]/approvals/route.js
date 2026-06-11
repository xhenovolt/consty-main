import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// POST /api/documents/[id]/approvals — submit for approval (creates approval steps)
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'documents.edit');
  if (perm instanceof NextResponse) {
    const fb = await requirePermission(request, 'documents.manage');
    if (fb instanceof NextResponse) return fb;
  }
  const { id } = await params;
  const { approver_ids } = await request.json().catch(() => ({}));
  if (!Array.isArray(approver_ids) || !approver_ids.length)
    return NextResponse.json({ success: false, error: 'approver_ids[] required' }, { status: 400 });

  await query(`UPDATE documents SET approval_status = 'in_review' WHERE id = $1`, [id]);
  await query('DELETE FROM document_approvals WHERE document_id = $1 AND status = $2', [id, 'pending']);

  const out = [];
  for (let i = 0; i < approver_ids.length; i++) {
    const r = await query(
      `INSERT INTO document_approvals (document_id, step_order, approver_id, status)
       VALUES ($1,$2,$3,'pending') RETURNING *`,
      [id, i + 1, approver_ids[i]]
    );
    out.push(r.rows[0]);
  }
  return NextResponse.json({ success: true, data: out });
}

// PATCH /api/documents/[id]/approvals — approver decision
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'documents.approve');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const { approval_id, status, comment } = await request.json().catch(() => ({}));
  if (!approval_id || !['approved', 'rejected'].includes(status))
    return NextResponse.json({ success: false, error: 'approval_id and status required' }, { status: 400 });

  const r = await query(
    `UPDATE document_approvals
       SET status = $1, decision_at = NOW(), comment = $2
     WHERE id = $3 AND document_id = $4 AND approver_id = $5 AND status = 'pending'
     RETURNING *`,
    [status, comment || null, approval_id, id, auth.userId]
  );
  if (!r.rows.length)
    return NextResponse.json({ success: false, error: 'Pending approval not found for this user' }, { status: 404 });

  // If rejected, mark doc rejected. If all approvers approved, mark approved.
  if (status === 'rejected') {
    await query(`UPDATE documents SET approval_status = 'rejected' WHERE id = $1`, [id]);
  } else {
    const pending = await query(
      `SELECT COUNT(*)::int AS n FROM document_approvals WHERE document_id = $1 AND status = 'pending'`,
      [id]
    );
    if (pending.rows[0].n === 0) {
      await query(
        `UPDATE documents SET approval_status = 'approved', approved_at = NOW(), approved_by = $1 WHERE id = $2`,
        [auth.userId, id]
      );
    }
  }
  return NextResponse.json({ success: true, data: r.rows[0] });
}
