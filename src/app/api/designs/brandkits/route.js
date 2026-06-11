import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'designs.view');
  if (perm instanceof NextResponse) return perm;
  const r = await query('SELECT * FROM design_brandkits ORDER BY is_default DESC, name');
  return NextResponse.json({ success: true, data: r.rows });
}

export async function POST(request) {
  const perm = await requirePermission(request, 'designs.create');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  const body = await request.json().catch(() => ({}));
  const { name, description, logos, palette, typography, voice, is_default } = body;
  if (!name) return NextResponse.json({ success: false, error: 'name required' }, { status: 400 });

  if (is_default) await query('UPDATE design_brandkits SET is_default = FALSE WHERE is_default = TRUE');

  const r = await query(
    `INSERT INTO design_brandkits (name, description, logos, palette, typography, voice, is_default, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      name, description || null,
      JSON.stringify(logos || []),
      JSON.stringify(palette || []),
      JSON.stringify(typography || []),
      JSON.stringify(voice || {}),
      !!is_default,
      auth.userId,
    ]
  );
  return NextResponse.json({ success: true, data: r.rows[0] }, { status: 201 });
}
