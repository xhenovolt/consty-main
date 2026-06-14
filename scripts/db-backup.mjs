#!/usr/bin/env node
/**
 * Backup-before-migrate. Writes a schema-only dump (always) and, unless
 * --schema-only is passed, a full dump too, into database/backups/.
 * Uses DATABASE_URL from the environment — no hardcoded credentials.
 *
 *   node scripts/db-backup.mjs            # schema + data
 *   node scripts/db-backup.mjs --schema-only
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: join(ROOT, '.env.local') });

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

// Neon runs PG17; the default /usr/bin/pg_dump may be older and will refuse on a
// server-version mismatch. Prefer an explicit v17 binary.
const PG_DUMP = process.env.PG_DUMP
  || ['/usr/lib/postgresql/17/bin/pg_dump', '/usr/pgsql-17/bin/pg_dump']
      .find(p => existsSync(p))
  || 'pg_dump';

const dir = join(ROOT, 'database', 'backups');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const schemaOnly = process.argv.includes('--schema-only');

function dump(file, args) {
  const out = join(dir, file);
  console.log(`→ ${file}`);
  execFileSync(PG_DUMP, [url, ...args, '-f', out], { stdio: ['ignore', 'inherit', 'inherit'] });
  return out;
}

try {
  dump(`schema_${stamp}.sql`, ['--schema-only', '--no-owner', '--no-privileges']);
  if (!schemaOnly) dump(`full_${stamp}.sql`, ['--no-owner', '--no-privileges']);
  console.log(`✓ Backup complete in database/backups/`);
} catch (e) {
  console.error('✗ Backup failed:', e.message);
  process.exit(1);
}
