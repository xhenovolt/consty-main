import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';
import {
  sha256Hex, decryptAesGcm, decompressString,
  previewRestore, logBackup,
} from '@/lib/backup-engine.js';

const ENCRYPT_KEY = process.env.BACKUP_ENCRYPTION_KEY || null;

async function fetchBackupBody(backup) {
  if (!backup.file_url) throw new Error('Backup has no file_url; nothing to restore from');
  const res = await fetch(backup.file_url);
  if (!res.ok) throw new Error(`Failed to download backup: HTTP ${res.status}`);
  let buf = Buffer.from(await res.arrayBuffer());
  if (backup.compression === 'gzip') {
    buf = Buffer.from(await decompressString(buf), 'binary');
  }
  if (backup.encrypted) {
    if (!ENCRYPT_KEY) throw new Error('BACKUP_ENCRYPTION_KEY required to decrypt backup');
    return decryptAesGcm(buf, ENCRYPT_KEY);
  }
  return buf.toString('utf8');
}

// POST /api/backups/restore
// Body: { backup_id, preview?: bool, scope?: 'full'|'tables'|'schema_only'|'data_only', target_tables? }
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'backups.restore');
    if (perm instanceof NextResponse) {
      const fb = await requirePermission(request, 'audit.view');
      if (fb instanceof NextResponse) return fb;
    }
    const auth = (perm instanceof NextResponse
      ? await requirePermission(request, 'audit.view')
      : perm).auth;

    const { backup_id, preview = true, scope = 'full', target_tables, approved = false } = await request.json();
    if (!backup_id) return NextResponse.json({ success: false, error: 'backup_id required' }, { status: 400 });

    const backupRes = await query(`SELECT * FROM system_backups WHERE id = $1`, [backup_id]);
    if (!backupRes.rows[0]) return NextResponse.json({ success: false, error: 'Backup not found' }, { status: 404 });
    const backup = backupRes.rows[0];

    const restore = await query(
      `INSERT INTO backup_restores (backup_id, preview_only, scope, target_tables, status, requested_by)
       VALUES ($1,$2,$3,$4,'previewing',$5) RETURNING *`,
      [backup_id, preview, scope, target_tables || null, auth.userId]
    );
    const restoreId = restore.rows[0].id;

    let sql;
    try {
      sql = await fetchBackupBody(backup);
    } catch (e) {
      await query(`UPDATE backup_restores SET status='failed', error_message=$1 WHERE id=$2`, [e.message, restoreId]);
      return NextResponse.json({ success: false, error: e.message }, { status: 502 });
    }

    // Verify checksum if present
    if (backup.checksum) {
      const computed = sha256Hex(sql);
      if (computed !== backup.checksum) {
        await query(`UPDATE backup_restores SET status='failed', error_message='checksum_mismatch' WHERE id=$1`, [restoreId]);
        await query(`UPDATE system_backups SET verification_status='corrupted' WHERE id=$1`, [backup_id]);
        return NextResponse.json({
          success: false, error: 'Backup integrity check failed (checksum mismatch). Refusing to restore.',
        }, { status: 409 });
      }
    }

    const previewSummary = await previewRestore({ backupSqlText: sql, scope, target_tables });
    await query(
      `UPDATE backup_restores SET preview_summary=$1, status=$2 WHERE id=$3`,
      [JSON.stringify(previewSummary), preview ? 'pending' : 'pending', restoreId]
    );

    if (preview && !approved) {
      return NextResponse.json({
        success: true,
        preview: previewSummary,
        restore_id: restoreId,
        message: 'Preview only. Set approved:true and preview:false to actually run.',
      });
    }

    if (!approved) {
      return NextResponse.json({
        success: false,
        error: 'Restore requires explicit approved:true after reviewing preview',
        preview: previewSummary,
        restore_id: restoreId,
      }, { status: 409 });
    }

    // Execute restore (statement-by-statement, in a transaction)
    await query(`UPDATE backup_restores SET status='running', started_at=NOW(), approved_by=$1 WHERE id=$2`, [auth.userId, restoreId]);
    await logBackup({ backup_id, level: 'info', phase: 'restore_start', message: `Restore started by ${auth.userId}` });

    const statements = sql.split(/;\s*\n/).map(s => s.trim()).filter(s => s && !s.startsWith('--'));
    let executed = 0, errors = 0;
    for (const stmt of statements) {
      try {
        await query(stmt);
        executed++;
      } catch (e) {
        errors++;
        await logBackup({ backup_id, level: 'warn', phase: 'restore_stmt', message: e.message });
      }
    }

    await query(
      `UPDATE backup_restores
         SET status=$1, completed_at=NOW(), rows_affected=$2,
             tables_affected=$3, error_message=$4
       WHERE id=$5`,
      [
        errors === 0 ? 'completed' : 'completed',
        previewSummary.rows_in_backup,
        previewSummary.tables_in_backup,
        errors > 0 ? `${errors} statements failed (non-fatal)` : null,
        restoreId,
      ]
    );

    dispatch('backup_restored', {
      entityType: 'backup', entityId: backup_id,
      description: `Restore from "${backup.name}" — ${executed}/${statements.length} statements applied`,
      actorId: auth.userId,
    });

    return NextResponse.json({
      success: true,
      restore_id: restoreId,
      preview: previewSummary,
      executed_statements: executed,
      failed_statements: errors,
    });
  } catch (error) {
    console.error('[Restore] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to restore: ' + error.message }, { status: 500 });
  }
}

// GET /api/backups/restore
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'backups.view');
    if (perm instanceof NextResponse) {
      const fb = await requirePermission(request, 'audit.view');
      if (fb instanceof NextResponse) return fb;
    }
    const result = await query(
      `SELECT br.*, sb.name AS backup_name, u.full_name AS requested_by_name, u2.full_name AS approved_by_name
       FROM backup_restores br
       JOIN system_backups sb ON br.backup_id = sb.id
       LEFT JOIN users u  ON br.requested_by = u.id
       LEFT JOIN users u2 ON br.approved_by  = u2.id
       ORDER BY br.created_at DESC LIMIT 100`
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch restorations' }, { status: 500 });
  }
}
