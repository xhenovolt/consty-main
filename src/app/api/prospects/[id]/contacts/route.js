import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/prospects/[id]/contacts
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'prospects.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const result = await query(`SELECT * FROM prospect_contacts WHERE prospect_id = $1 ORDER BY is_primary DESC, name ASC`, [id]);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

// POST /api/prospects/[id]/contacts
export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'prospects.create');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const body = await request.json();
    const { name, title, email, phone, is_primary, notes } = body;
    if (!name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });

    // If setting as primary, unset others
    if (is_primary) {
      await query(`UPDATE prospect_contacts SET is_primary = false WHERE prospect_id = $1`, [id]);
    }

    const result = await query(
      `INSERT INTO prospect_contacts (prospect_id, name, title, email, phone, is_primary, notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, name, title||null, email||null, phone||null, is_primary||false, notes||null]
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create contact' }, { status: 500 });
  }
}
