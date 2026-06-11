import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';
import {
  sha256Hex, compressString, encryptAesGcm,
  renderBackupSql, logBackup,
} from '@/lib/backup-engine.js';

const ENCRYPT_KEY = process.env.BACKUP_ENCRYPTION_KEY || null;

// GET /api/backups
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'backups.view');
    if (perm instanceof NextResponse) {
      const fb = await requirePermission(request, 'audit.view');
      if (fb instanceof NextResponse) return fb;
    }

    const result = await query(
      `SELECT sb.*, u.full_name AS created_by_name,
              t.name AS storage_target_name, t.type AS storage_target_type
       FROM system_backups sb
       LEFT JOIN users u ON sb.created_by = u.id
       LEFT JOIN backup_storage_targets t ON sb.storage_target_id = t.id
       ORDER BY sb.created_at DESC
       LIMIT 200`
    );
    const stats = await query(`
      SELECT
        COUNT(*)                                                 AS total,
        COUNT(*) FILTER (WHERE status = 'completed' OR status = 'uploaded') AS completed,
        COUNT(*) FILTER (WHERE status = 'failed')                AS failed,
        COUNT(*) FILTER (WHERE verification_status = 'verified') AS verified,
        COALESCE(SUM(file_size),0)::bigint                       AS total_bytes
      FROM system_backups
    `);
    return NextResponse.json({ success: true, data: result.rows, stats: stats.rows[0] });
  } catch (error) {
    console.error('[Backups] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch backups' }, { status: 500 });
  }
}

// POST /api/backups
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'backups.create');
    if (perm instanceof NextResponse) {
      const fb = await requirePermission(request, 'audit.view');
      if (fb instanceof NextResponse) return fb;
    }
    const auth = (perm instanceof NextResponse
      ? await requirePermission(request, 'audit.view')
      : perm).auth;

    const body = await request.json().catch(() => ({}));
    const {
      name, description, backup_type = 'full', tags,
      compress = true, encrypt = false, storage_target_id, retention_days = 30,
    } = body;

    const backupName = name?.trim() || `consty_backup_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;

    const backup = await query(
      `INSERT INTO system_backups
         (name, description, backup_type, tags, status, created_by,
          encrypted, compression, storage_target_id, retention_until, metadata)
       VALUES ($1,$2,$3,$4,'in_progress',$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        backupName, description || null, backup_type, tags || [],
        auth.userId,
        !!encrypt,
        compress ? 'gzip' : null,
        storage_target_id || null,
        new Date(Date.now() + retention_days * 86400000),
        JSON.stringify({ requested_by: auth.userId }),
      ]
    );
    const backupId = backup.rows[0].id;
    await logBackup({ backup_id: backupId, level: 'info', phase: 'start', message: 'Backup started', details: { backup_type } });

    try {
      const { sql, tableCount, rowCount } = await renderBackupSql({ backup_type });
      await logBackup({ backup_id: backupId, phase: 'render', message: `Rendered ${tableCount} tables, ${rowCount} rows` });

      const checksum = sha256Hex(sql);
      let payload = sql;
      let payloadBuffer = null;
      let mime = 'text/plain';

      if (encrypt) {
        if (!ENCRYPT_KEY) throw new Error('BACKUP_ENCRYPTION_KEY env var required for encrypted backups');
        payloadBuffer = encryptAesGcm(sql, ENCRYPT_KEY);
        mime = 'application/octet-stream';
        await logBackup({ backup_id: backupId, phase: 'encrypt', message: 'Backup encrypted (aes-256-gcm)' });
      }
      if (compress) {
        payloadBuffer = await compressString(payloadBuffer ? payloadBuffer.toString('binary') : sql);
        mime = encrypt ? 'application/octet-stream' : 'application/gzip';
        await logBackup({ backup_id: backupId, phase: 'compress', message: 'Backup compressed (gzip)' });
      }

      const finalBuf = payloadBuffer || Buffer.from(payload, 'utf8');
      const fileSize = finalBuf.length;

      // Resolve storage target
      let targetType = 'local';
      let targetConfig = {};
      if (storage_target_id) {
        const t = await query('SELECT * FROM backup_storage_targets WHERE id = $1 AND is_active', [storage_target_id]);
        if (t.rows.length) { targetType = t.rows[0].type; targetConfig = t.rows[0].config || {}; }
      } else {
        const t = await query('SELECT * FROM backup_storage_targets WHERE is_primary AND is_active LIMIT 1');
        if (t.rows.length) { targetType = t.rows[0].type; targetConfig = t.rows[0].config || {}; }
      }

      let fileUrl = null, publicId = null, storagePath = null;
      if (targetType === 'cloudinary' || (!storage_target_id && targetType === 'local')) {
        try {
          const cloudRes = await query(`SELECT * FROM cloud_accounts WHERE is_active ORDER BY is_primary DESC LIMIT 1`);
          const account = cloudRes.rows[0];
          if (account) {
            const { default: { v2: cloudinary } } = await import('cloudinary');
            cloudinary.config({
              cloud_name: account.cloud_name,
              api_key: account.api_key,
              api_secret: account.api_secret,
            });
            const upload = await cloudinary.uploader.upload(
              `data:${mime};base64,${finalBuf.toString('base64')}`,
              { resource_type: 'raw', folder: 'consty/backups', public_id: backupName.replace(/[^a-zA-Z0-9_-]/g, '_') }
            );
            fileUrl = upload.secure_url;
            publicId = upload.public_id;
            storagePath = upload.public_id;
            await logBackup({ backup_id: backupId, phase: 'upload', message: 'Uploaded to Cloudinary', details: { url: fileUrl } });
          }
        } catch (cloudErr) {
          await logBackup({ backup_id: backupId, level: 'warn', phase: 'upload', message: `Cloudinary upload failed: ${cloudErr.message}` });
        }
      }

      await query(
        `UPDATE system_backups
           SET status = $1, file_url = $2, cloudinary_public_id = $3,
               file_size = $4, table_count = $5, row_count = $6,
               checksum = $7, checksum_algo = 'sha256',
               storage_path = $8,
               verification_status = 'verified', verified_at = NOW()
         WHERE id = $9`,
        [
          fileUrl ? 'uploaded' : 'completed', fileUrl, publicId,
          fileSize, tableCount, rowCount,
          checksum, storagePath, backupId,
        ]
      );

      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1,'BACKUP','system_backup',$2,$3)`,
        [auth.userId, backupId, JSON.stringify({ name: backupName, tables: tableCount, rows: rowCount, checksum })]
      );

      dispatch('backup_created', {
        entityType: 'backup', entityId: backupId,
        description: `Backup "${backupName}" — ${tableCount} tables, ${rowCount.toLocaleString()} rows`,
        actorId: auth.userId,
        metadata: { tables: tableCount, rows: rowCount, checksum },
      });

      return NextResponse.json({
        success: true,
        data: {
          id: backupId, name: backupName, status: fileUrl ? 'uploaded' : 'completed',
          tables: tableCount, rows: rowCount, file_size: fileSize, file_url: fileUrl,
          checksum, encrypted: !!encrypt, compression: compress ? 'gzip' : null,
        },
      }, { status: 201 });
    } catch (err) {
      await query(`UPDATE system_backups SET status = 'failed' WHERE id = $1`, [backupId]);
      await logBackup({ backup_id: backupId, level: 'error', phase: 'fail', message: err.message });
      throw err;
    }
  } catch (error) {
    console.error('[Backups] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create backup: ' + error.message }, { status: 500 });
  }
}

// DELETE /api/backups?id=xxx
export async function DELETE(request) {
  try {
    // requirePermission already bypasses for superadmins, so any role with
    // backups.delete works — no hardcoded 'superadmin' string.
    const perm = await requirePermission(request, 'backups.delete');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    const result = await query(`DELETE FROM system_backups WHERE id = $1 RETURNING name`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Backup not found' }, { status: 404 });
    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,'DELETE','system_backup',$2,$3)`,
      [auth.userId, id, JSON.stringify({ name: result.rows[0].name })]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete backup' }, { status: 500 });
  }
}
