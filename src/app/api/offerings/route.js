import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/offerings
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'offerings.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const active = searchParams.get('active');
    let sql = `SELECT o.*, (SELECT COUNT(*) FROM deals d WHERE d.offering_id = o.id) as deal_count FROM offerings o WHERE 1=1`;
    const params = [];
    if (type) { params.push(type); sql += ` AND o.type = $${params.length}`; }
    if (active === 'true') sql += ` AND o.is_active = true`;
    sql += ` ORDER BY o.name ASC`;
    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch offerings' }, { status: 500 });
  }
}

// POST /api/offerings
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'offerings.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const body = await request.json();
    const { name, type, description, default_price, currency, unit, metadata } = body;
    if (!name || !type) return NextResponse.json({ success: false, error: 'name and type are required' }, { status: 400 });
    const result = await query(
      `INSERT INTO offerings (name, type, description, default_price, currency, unit, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, type, description||null, default_price||null, currency||'UGX', unit||null, metadata ? JSON.stringify(metadata) : '{}']
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create offering' }, { status: 500 });
  }
}
