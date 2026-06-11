/**
 * Backup engine — checksums, restore-preview, log emission.
 *
 * Backups are produced as text SQL with row-level INSERT … ON CONFLICT DO NOTHING.
 * The checksum is computed over the uncompressed plaintext so it round-trips
 * regardless of which storage target is used.
 */

import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { query } from './db.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export function sha256Hex(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function compressString(text) {
  return gzip(Buffer.from(text, 'utf8'));
}

export async function decompressString(buf) {
  return (await gunzip(buf)).toString('utf8');
}

export function encryptAesGcm(plaintext, keyBase64) {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes (base64-encoded)');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

export function decryptAesGcm(buffer, keyBase64) {
  const key = Buffer.from(keyBase64, 'base64');
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const ct = buffer.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

export async function logBackup({ backup_id, job_id, level = 'info', phase, message, details }) {
  try {
    await query(
      `INSERT INTO backup_logs (backup_id, job_id, level, phase, message, details)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        backup_id || null, job_id || null, level, phase || null, message,
        details ? JSON.stringify(details) : '{}',
      ]
    );
  } catch (err) {
    console.error('[backup-engine] logBackup failed:', err.message);
  }
}

/**
 * Build a list of tables to back up plus row counts. Used both for "real"
 * backup runs and for restore-preview (so we can warn before clobbering data).
 */
export async function inventoryTables() {
  const r = await query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const out = [];
  for (const { tablename } of r.rows) {
    const c = await query(`SELECT COUNT(*)::int AS n FROM "${tablename}"`);
    out.push({ table: tablename, rows: c.rows[0].n });
  }
  return out;
}

/**
 * Render a backup payload as SQL (full | schema_only | data_only).
 * Returns { sql, tableCount, rowCount }.
 */
export async function renderBackupSql({ backup_type = 'full', tables: filter } = {}) {
  const inv = await inventoryTables();
  const targets = filter && filter.length ? inv.filter(t => filter.includes(t.table)) : inv;
  const parts = [];
  parts.push(`-- Consty backup`);
  parts.push(`-- Generated: ${new Date().toISOString()}`);
  parts.push(`-- Type: ${backup_type}`);
  parts.push(`-- Tables: ${targets.length}`);
  parts.push('');

  let totalRows = 0;
  for (const t of targets) {
    if (backup_type !== 'data_only') {
      const colsRes = await query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [t.table]
      );
      parts.push(`-- Schema for ${t.table}: ${colsRes.rows.length} columns`);
    }
    if (backup_type !== 'schema_only' && t.rows > 0) {
      const data = await query(`SELECT * FROM "${t.table}"`);
      const cols = Object.keys(data.rows[0]);
      parts.push(`-- Data for ${t.table}: ${data.rows.length} rows`);
      for (const row of data.rows) {
        const vals = cols.map(c => {
          const v = row[c];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return v;
          if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
          if (v instanceof Date) return `'${v.toISOString()}'`;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          return `'${String(v).replace(/'/g, "''")}'`;
        });
        parts.push(
          `INSERT INTO "${t.table}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${vals.join(',')}) ON CONFLICT DO NOTHING;`
        );
      }
      parts.push('');
      totalRows += data.rows.length;
    }
  }

  return { sql: parts.join('\n'), tableCount: targets.length, rowCount: totalRows };
}

/**
 * Produce a preview of what restoring the given backup would do without
 * actually writing anything. Compares table row counts before/after.
 */
export async function previewRestore({ backupSqlText, scope = 'full', target_tables }) {
  const insertRe = /^INSERT INTO "([^"]+)"/gm;
  const counts = {};
  let m;
  while ((m = insertRe.exec(backupSqlText))) {
    counts[m[1]] = (counts[m[1]] || 0) + 1;
  }
  const filtered = target_tables && target_tables.length
    ? Object.fromEntries(Object.entries(counts).filter(([k]) => target_tables.includes(k)))
    : counts;

  const current = {};
  for (const tbl of Object.keys(filtered)) {
    try {
      const r = await query(`SELECT COUNT(*)::int AS n FROM "${tbl}"`);
      current[tbl] = r.rows[0].n;
    } catch {
      current[tbl] = null;
    }
  }

  return {
    scope,
    tables_in_backup: Object.keys(filtered).length,
    rows_in_backup: Object.values(filtered).reduce((a, b) => a + b, 0),
    per_table: Object.entries(filtered).map(([table, incoming]) => ({
      table,
      incoming_rows: incoming,
      current_rows: current[table],
      table_exists: current[table] !== null,
    })),
  };
}
