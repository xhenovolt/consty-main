#!/usr/bin/env node
/**
 * CONSTY raw-SQL migration runner (no ORM).
 *
 * - Applies database/migrations/*.sql in filename order.
 * - Records each applied file in schema_migrations (skips already-applied).
 * - Each file runs inside a transaction; a failure rolls that file back.
 * - Idempotent: safe to re-run.
 *
 *   node scripts/migrate.mjs            # apply pending migrations
 *   node scripts/migrate.mjs --dry-run  # list pending, apply nothing
 *
 * Uses DATABASE_URL from .env.local — no hardcoded credentials.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: join(ROOT, '.env.local') });

const DRY = process.argv.includes('--dry-run');
const MIG_DIR = join(ROOT, 'database', 'migrations');
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const client = new pg.Client({ connectionString: url });

async function ensureTracking() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      checksum text,
      applied_at timestamptz NOT NULL DEFAULT now()
    );`);
}

async function applied() {
  const { rows } = await client.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map(r => r.filename));
}

async function run() {
  await client.connect();
  await ensureTracking();
  const done = await applied();

  const files = readdirSync(MIG_DIR).filter(f => f.endsWith('.sql')).sort();
  const pending = files.filter(f => !done.has(f));

  if (pending.length === 0) { console.log('✓ No pending migrations.'); return; }
  console.log(`Pending (${pending.length}): ${pending.join(', ')}`);
  if (DRY) { console.log('(dry-run — nothing applied)'); return; }

  for (const f of pending) {
    const sql = readFileSync(join(MIG_DIR, f), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex').slice(0, 16);
    process.stdout.write(`→ ${f} ... `);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT (filename) DO NOTHING',
        [f, checksum]
      );
      await client.query('COMMIT');
      console.log('ok');
    } catch (e) {
      await client.query('ROLLBACK');
      console.log('FAILED');
      console.error(`\n✗ ${f}: ${e.message}\n`);
      process.exit(1);
    }
  }
  console.log('✓ Migrations applied.');
}

run()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => client.end());
