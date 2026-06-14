#!/usr/bin/env node
/**
 * Post-migration verification for the CONSTY PM domain.
 * Confirms every expected table, function, and a sample of FK/CHECK constraints
 * exist. Exits non-zero on any missing object. Read-only.
 *
 *   node scripts/verify-schema.mjs
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: join(ROOT, '.env.local') });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const EXPECTED_TABLES = [
  'schema_migrations', 'feature_flags',
  'projects', 'project_members', 'work_items', 'work_item_dependencies',
  'suppliers', 'resources', 'resource_relations', 'resource_allocations', 'resource_movements',
  'procurement_requests', 'procurement_request_lines', 'goods_receipts',
  'project_budgets', 'funding_sources', 'budget_lines', 'commitments',
  'blockers', 'change_orders',
  'inspection_checklists', 'inspection_checklist_items', 'inspections', 'defects',
  'risks', 'project_issues', 'project_closures',
];
const EXPECTED_FUNCTIONS = ['fn_rollup_project', 'fn_project_health', 'fn_budget_status'];
const EXPECTED_FKS = [
  'work_items', 'project_members', 'work_item_dependencies', 'resources',
  'procurement_requests', 'project_budgets', 'commitments', 'blockers', 'defects',
];

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { console.log(`  ✗ ${m}`); failures++; };

async function main() {
  await client.connect();

  console.log('Tables:');
  const { rows: t } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
  const have = new Set(t.map(r => r.table_name));
  for (const tbl of EXPECTED_TABLES) have.has(tbl) ? ok(tbl) : bad(`missing table ${tbl}`);

  console.log('Functions:');
  const { rows: fns } = await client.query(
    `SELECT proname FROM pg_proc WHERE proname = ANY($1)`, [EXPECTED_FUNCTIONS]);
  const haveFn = new Set(fns.map(r => r.proname));
  for (const fn of EXPECTED_FUNCTIONS) haveFn.has(fn) ? ok(fn + '()') : bad(`missing function ${fn}`);

  console.log('Foreign keys present on:');
  for (const tbl of EXPECTED_FKS) {
    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.table_constraints
        WHERE table_name=$1 AND constraint_type='FOREIGN KEY'`, [tbl]);
    rows[0].n > 0 ? ok(`${tbl} (${rows[0].n} FK)`) : bad(`no FK on ${tbl}`);
  }

  console.log('CHECK constraints present on projects/work_items/resources:');
  for (const tbl of ['projects', 'work_items', 'resources']) {
    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.table_constraints
        WHERE table_name=$1 AND constraint_type='CHECK'`, [tbl]);
    rows[0].n > 0 ? ok(`${tbl} (${rows[0].n} CHECK)`) : bad(`no CHECK on ${tbl}`);
  }

  console.log(failures === 0
    ? '\n✓ Schema verification PASSED'
    : `\n✗ Schema verification FAILED (${failures} problem(s))`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => client.end());
