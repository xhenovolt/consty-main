import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'backups.view');
  if (perm instanceof NextResponse) return perm;
  const r = await query('SELECT * FROM backup_storage_targets ORDER BY is_primary DESC, name');
  return NextResponse.json({ success: true, data: r.rows });
}

export async function POST(request) {
  const perm = await requirePermission(request, 'backups.schedule');
  if (perm instanceof NextResponse) {
    const fb = await requirePermission(request, 'backups.create');
    if (fb instanceof NextResponse) return fb;
  }

  const body = await request.json().catch(() => ({}));
  const { name, type, config, is_primary } = body;
  if (!name || !type) return NextResponse.json({ success: false, error: 'name and type required' }, { status: 400 });
  if (!['local', 'cloudinary', 's3', 'custom'].includes(type))
    return NextResponse.json({ success: false, error: 'invalid type' }, { status: 400 });

  if (is_primary) {
    await query('UPDATE backup_storage_targets SET is_primary = FALSE WHERE is_primary = TRUE');
  }
  const r = await query(
    `INSERT INTO backup_storage_targets (name, type, config, is_primary)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, type, JSON.stringify(config || {}), !!is_primary]
  );
  return NextResponse.json({ success: true, data: r.rows[0] }, { status: 201 });
}
