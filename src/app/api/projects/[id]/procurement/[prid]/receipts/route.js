import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

const INSPECTION = ['pending','passed','failed','conditional'];

// POST /api/projects/[id]/procurement/[prid]/receipts — record goods receipt + inspection
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id, prid } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const pr = (await query(`SELECT id, supplier_id FROM procurement_requests WHERE id=$1 AND project_id=$2`, [prid, id])).rows[0];
    if (!pr) return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });

    const b = await request.json();
    const inspection = b.inspection_status && INSPECTION.includes(b.inspection_status) ? b.inspection_status : 'pending';
    const { rows } = await query(
      `INSERT INTO goods_receipts
         (procurement_request_id, supplier_id, received_qty, rejected_qty, inspection_status, inspected_by, receipt_url, stored_to_location, notes)
       VALUES ($1::uuid,$2::uuid,COALESCE($3,0),COALESCE($4,0),$5,$6::uuid,$7,$8,$9)
       RETURNING *`,
      [prid, b.supplier_id || pr.supplier_id || null, b.received_qty ?? null, b.rejected_qty ?? null,
       inspection, inspection === 'pending' ? null : auth.userId, b.receipt_url || null, b.stored_to_location || null, b.notes || null]
    );

    // Advance the request to 'received' (or 'inspected' once inspection is set).
    const newStatus = inspection === 'pending' ? 'received' : 'inspected';
    await query(`UPDATE procurement_requests SET status=$1, updated_at=now()
                 WHERE id=$2 AND status NOT IN ('closed','rejected')`, [newStatus, prid]);

    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[GoodsReceipt] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to record receipt' }, { status: 500 });
  }
}
