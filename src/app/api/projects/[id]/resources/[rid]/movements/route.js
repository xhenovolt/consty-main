import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

const TYPES = ['receive','inspect','store','issue','transfer','consume','return','waste','adjust'];

// GET /api/projects/[id]/resources/[rid]/movements — ledger history
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { id, rid } = await params;
  const gate = await assertProjectAccess(perm.auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  const { rows } = await query(
    `SELECT m.*, u.name AS moved_by_name FROM resource_movements m
     LEFT JOIN users u ON u.id = m.moved_by
     WHERE m.resource_id = $1 ORDER BY m.moved_at DESC`, [rid]);
  return NextResponse.json({ success: true, data: rows });
}

// POST /api/projects/[id]/resources/[rid]/movements — record + apply quantity effect
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id, rid } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const b = await request.json();
    const type = b.movement_type;
    const qty = Number(b.quantity);
    if (!TYPES.includes(type)) return NextResponse.json({ success: false, error: 'Invalid movement_type' }, { status: 400 });
    if (!(qty >= 0)) return NextResponse.json({ success: false, error: 'quantity must be >= 0' }, { status: 400 });

    const { rows: rrows } = await query(`SELECT * FROM resources WHERE id = $1 AND project_id = $2`, [rid, id]);
    const res = rrows[0];
    if (!res) return NextResponse.json({ success: false, error: 'Resource not found' }, { status: 404 });

    const avail = Number(res.quantity_available);
    // Compute deltas to the running quantity columns.
    let dAvail = 0, dCons = 0, dRet = 0, dWaste = 0;
    switch (type) {
      case 'receive':  dAvail = qty; break;
      case 'consume':  dAvail = -qty; dCons = qty; break;
      case 'waste':    dAvail = -qty; dWaste = qty; break;
      case 'return':   dAvail = qty;  dRet = qty; break;
      case 'adjust':   dAvail = qty - avail; break; // set available to qty
      default:         break; // inspect/store/issue/transfer: ledger-only
    }
    if ((type === 'consume' || type === 'waste') && qty > avail)
      return NextResponse.json({ success: false, error: `Only ${avail} ${res.unit_of_measure || 'units'} available` }, { status: 400 });

    // Atomic: insert the movement and apply the quantity effect together.
    const { rows } = await query(
      `WITH mv AS (
         INSERT INTO resource_movements
           (resource_id, movement_type, quantity, from_location, to_location, work_item_id, supplier_id, reference, notes, moved_by)
         VALUES ($1::uuid,$2,$3,$4,$5,$6::uuid,$7::uuid,$8,$9,$10::uuid)
         RETURNING id
       )
       UPDATE resources SET
         quantity_available = quantity_available + $11,
         quantity_consumed  = quantity_consumed  + $12,
         quantity_returned  = quantity_returned  + $13,
         quantity_wasted    = quantity_wasted    + $14,
         updated_at = now()
       WHERE id = $1::uuid
       RETURNING *`,
      [rid, type, qty, b.from_location || null, b.to_location || null, b.work_item_id || null,
       b.supplier_id || null, b.reference || null, b.notes || null, auth.userId,
       dAvail, dCons, dRet, dWaste]
    );
    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Movements] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to record movement' }, { status: 500 });
  }
}
