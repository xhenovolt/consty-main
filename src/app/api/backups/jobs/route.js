import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/backups/jobs
export async function GET(request) {
  const perm = await requirePermission(request, 'backups.view');
  if (perm instanceof NextResponse) return perm;
  const r = await query(
    `SELECT j.*, t.name AS storage_target_name
     FROM backup_jobs j
     LEFT JOIN backup_storage_targets t ON j.storage_target_id = t.id
     ORDER BY j.created_at DESC`
  );
  return NextResponse.json({ success: true, data: r.rows });
}

// POST /api/backups/jobs
export async function POST(request) {
  const perm = await requirePermission(request, 'backups.schedule');
  if (perm instanceof NextResponse) {
    const fb = await requirePermission(request, 'backups.create');
    if (fb instanceof NextResponse) return fb;
  }
  const auth = (perm instanceof NextResponse
    ? await requirePermission(request, 'backups.create')
    : perm).auth;

  const body = await request.json().catch(() => ({}));
  const {
    name, description, backup_type = 'full', schedule_cron,
    storage_target_id, encrypt = false, compress = true, retention_days = 30,
  } = body;
  if (!name) return NextResponse.json({ success: false, error: 'name required' }, { status: 400 });

  const r = await query(
    `INSERT INTO backup_jobs
       (name, description, backup_type, schedule_cron, storage_target_id,
        encrypt, compress, retention_days, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [name, description || null, backup_type, schedule_cron || null, storage_target_id || null,
     !!encrypt, !!compress, retention_days, auth.userId]
  );
  return NextResponse.json({ success: true, data: r.rows[0] }, { status: 201 });
}
