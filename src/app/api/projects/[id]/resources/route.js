import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { assertProjectAccess } from '@/lib/project-access.js';

const CATEGORIES = ['labour','staff','subcontractor','equipment','vehicle','material','tool','fuel',
                    'water','power','money','document','permit','reusable_asset','consumable'];

// GET /api/projects/[id]/resources
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const gate = await assertProjectAccess(perm.auth, id);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  const { rows } = await query(
    `SELECT r.*, s.name AS supplier_name
     FROM resources r LEFT JOIN suppliers s ON s.id = r.supplier_id
     WHERE r.project_id = $1 ORDER BY r.category, r.name`, [id]
  );
  return NextResponse.json({ success: true, data: rows });
}

// POST /api/projects/[id]/resources
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });

  try {
    const b = await request.json();
    if (!b.name || !b.category) return NextResponse.json({ success: false, error: 'name and category are required' }, { status: 400 });
    if (!CATEGORIES.includes(b.category)) return NextResponse.json({ success: false, error: 'Invalid category' }, { status: 400 });

    const { rows } = await query(
      `INSERT INTO resources
         (project_id, name, category, type, unit_of_measure, size, mass_kg,
          quantity_required, quantity_available, unit_cost, currency, condition,
          manufacturer, supplier_id, source, storage_location, is_reusable, attributes, notes, catalog_item_id, created_by)
       VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,
               COALESCE($8,0),COALESCE($9,0),COALESCE($10,0),COALESCE($11,'UGX'),$12,
               $13,$14::uuid,$15,$16,COALESCE($17,false),COALESCE($18,'{}')::jsonb,$19,$20::uuid,$21::uuid)
       RETURNING *`,
      [id, b.name, b.category, b.type || null, b.unit_of_measure || null, b.size || null, b.mass_kg ?? null,
       b.quantity_required ?? null, b.quantity_available ?? null, b.unit_cost ?? null, b.currency || null, b.condition || null,
       b.manufacturer || null, b.supplier_id || null, b.source || null, b.storage_location || null,
       b.is_reusable ?? null, b.attributes ? JSON.stringify(b.attributes) : null, b.notes || null, b.catalog_item_id || null, auth.userId]
    );
    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Resources] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create resource' }, { status: 500 });
  }
}
