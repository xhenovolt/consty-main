import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/designs/[id]/layers — first-class layer rows
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'designs.view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const r = await query(
    'SELECT * FROM design_layers WHERE design_id = $1 ORDER BY display_order, created_at',
    [id]
  );
  return NextResponse.json({ success: true, data: r.rows });
}

// PUT /api/designs/[id]/layers — replace the layer set (used after editor save)
export async function PUT(request, { params }) {
  const perm = await requirePermission(request, 'designs.update');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const layers = Array.isArray(body.layers) ? body.layers : [];

  await query('DELETE FROM design_layers WHERE design_id = $1', [id]);
  for (let i = 0; i < layers.length; i++) {
    const l = layers[i];
    await query(
      `INSERT INTO design_layers
         (design_id, layer_key, layer_type, display_order, locked, hidden, opacity, blend_mode, rotation, position, size, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        l.key || `layer_${i}`,
        l.type || 'shape',
        l.display_order ?? i,
        !!l.locked,
        !!l.hidden,
        l.opacity ?? 1.0,
        l.blend_mode || null,
        l.rotation ?? 0,
        JSON.stringify(l.position || {}),
        JSON.stringify(l.size || {}),
        JSON.stringify(l.data || {}),
      ]
    );
  }
  return NextResponse.json({ success: true, count: layers.length });
}
