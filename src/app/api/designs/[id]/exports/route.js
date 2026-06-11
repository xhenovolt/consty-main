import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'designs.view');
  if (perm instanceof NextResponse) return perm;
  const { id } = await params;
  const r = await query(
    `SELECT e.*, u.full_name AS exported_by_name
     FROM design_exports e
     LEFT JOIN users u ON e.exported_by = u.id
     WHERE e.design_id = $1 ORDER BY e.exported_at DESC`,
    [id]
  );
  return NextResponse.json({ success: true, data: r.rows });
}

// POST /api/designs/[id]/exports — record an export (UI rasterises and uploads, then posts metadata)
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'designs.view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { format, width, height, dpi, file_url, file_size } = body;
  if (!format || !['png', 'jpg', 'svg', 'pdf'].includes(format))
    return NextResponse.json({ success: false, error: 'format required (png|jpg|svg|pdf)' }, { status: 400 });

  const r = await query(
    `INSERT INTO design_exports (design_id, format, width, height, dpi, file_url, file_size, exported_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id, format, width || null, height || null, dpi || 96, file_url || null, file_size || null, auth.userId]
  );
  return NextResponse.json({ success: true, data: r.rows[0] }, { status: 201 });
}
