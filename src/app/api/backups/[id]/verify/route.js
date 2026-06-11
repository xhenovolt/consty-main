import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { sha256Hex, decryptAesGcm, decompressString, logBackup } from '@/lib/backup-engine.js';

const ENCRYPT_KEY = process.env.BACKUP_ENCRYPTION_KEY || null;

// POST /api/backups/[id]/verify — re-fetches the backup payload, re-computes checksum.
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'backups.view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const r = await query('SELECT * FROM system_backups WHERE id = $1', [id]);
    if (!r.rows[0]) return NextResponse.json({ success: false, error: 'Backup not found' }, { status: 404 });
    const b = r.rows[0];
    if (!b.file_url) return NextResponse.json({ success: false, error: 'No file_url' }, { status: 409 });

    const res = await fetch(b.file_url);
    if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
    let buf = Buffer.from(await res.arrayBuffer());
    if (b.compression === 'gzip') buf = Buffer.from(await decompressString(buf), 'binary');
    let plaintext;
    if (b.encrypted) {
      if (!ENCRYPT_KEY) throw new Error('BACKUP_ENCRYPTION_KEY env var required');
      plaintext = decryptAesGcm(buf, ENCRYPT_KEY);
    } else {
      plaintext = buf.toString('utf8');
    }

    const computed = sha256Hex(plaintext);
    const ok = !b.checksum || computed === b.checksum;
    await query(
      `UPDATE system_backups
         SET verified_at = NOW(),
             verification_status = $1,
             checksum = COALESCE(checksum, $2)
       WHERE id = $3`,
      [ok ? 'verified' : 'corrupted', computed, id]
    );
    await logBackup({
      backup_id: id, level: ok ? 'info' : 'error', phase: 'verify',
      message: ok ? 'Checksum verified' : 'Checksum mismatch',
      details: { stored: b.checksum, computed },
    });
    return NextResponse.json({ success: true, verified: ok, computed_checksum: computed });
  } catch (e) {
    console.error('[Backups] verify error:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
