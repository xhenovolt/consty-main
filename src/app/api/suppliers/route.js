import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/suppliers — global supplier pool (any project viewer)
export async function GET(request) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const search = new URL(request.url).searchParams.get('search');
  let sql = `SELECT * FROM suppliers WHERE is_active = true`;
  const params = [];
  if (search) { params.push(`%${search}%`); sql += ` AND name ILIKE $${params.length}`; }
  sql += ` ORDER BY name`;
  const { rows } = await query(sql, params);
  return NextResponse.json({ success: true, data: rows });
}

// POST /api/suppliers — create (projects.edit)
export async function POST(request) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  try {
    const b = await request.json();
    if (!b.name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    const { rows } = await query(
      `INSERT INTO suppliers (name, contact_name, phone, email, category, lead_time_days, address, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::uuid) RETURNING *`,
      [b.name, b.contact_name || null, b.phone || null, b.email || null, b.category || null,
       b.lead_time_days ?? null, b.address || null, b.notes || null, auth.userId]
    );
    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Suppliers] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create supplier' }, { status: 500 });
  }
}
