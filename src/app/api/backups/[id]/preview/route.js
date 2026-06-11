import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { decryptAesGcm, decompressString, previewRestore } from '@/lib/backup-engine.js';

const ENCRYPT_KEY = process.env.BACKUP_ENCRYPTION_KEY || null;

// GET /api/backups/[id]/preview — what would happen on restore
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'backups.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const r = await query('SELECT * FROM system_backups WHERE id = $1', [id]);
    if (!r.rows[0]) return NextResponse.json({ success: false, error: 'Backup not found' }, { status: 404 });
    const b = r.rows[0];
    if (!b.file_url) return NextResponse.json({ success: false, error: 'No file_url' }, { status: 409 });

    const res = await fetch(b.file_url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let buf = Buffer.from(await res.arrayBuffer());
    if (b.compression === 'gzip') buf = Buffer.from(await decompressString(buf), 'binary');
    const sql = b.encrypted
      ? decryptAesGcm(buf, ENCRYPT_KEY)
      : buf.toString('utf8');

    const summary = await previewRestore({ backupSqlText: sql });
    return NextResponse.json({ success: true, preview: summary, backup: { id: b.id, name: b.name, checksum: b.checksum } });
  } catch (e) {
    console.error('[Backups] preview error:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
