#!/usr/bin/env node
/**
 * CONSTY PM-domain integration tests.
 * Runs the most important flows against the REAL database inside a single
 * transaction that is ALWAYS rolled back — nothing persists. Safe on Neon.
 *
 *   node scripts/test-db.mjs
 *
 * Covers: project + WBS creation, progress rollup math (incl. weighting),
 * project health stub, budget-status derivation, per-project membership +
 * unique constraint, and CHECK-constraint enforcement.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: join(ROOT, '.env.local') });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ ${msg}`); }
}
async function expectError(fn, msg) {
  await client.query('SAVEPOINT sp');
  try { await fn(); await client.query('RELEASE SAVEPOINT sp'); assert(false, msg + ' (expected error, got none)'); }
  catch { await client.query('ROLLBACK TO SAVEPOINT sp'); assert(true, msg); }
}

async function main() {
  await client.connect();
  await client.query('BEGIN');
  try {
    const { rows: [u] } = await client.query(`SELECT id FROM users LIMIT 1`);
    const uid = u?.id ?? null;

    // ── Project + WBS tree ────────────────────────────────────────────
    const { rows: [p] } = await client.query(
      `INSERT INTO projects (code, name, type, status, created_by) VALUES ($1,$2,'construction','active',$3) RETURNING id`,
      [`TEST-${Date.now()}`, 'Test Project', uid]);
    const pid = p.id;
    assert(!!pid, 'create project');

    const ins = async (type, parent, name, weight = 1) => (await client.query(
      `INSERT INTO work_items (project_id, type, parent_id, name, weight, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [pid, type, parent, name, weight, uid])).rows[0].id;

    const stage = await ins('stage', null, 'Stage 1');
    const ms    = await ins('milestone', stage, 'Milestone 1');
    const wp    = await ins('work_package', ms, 'Work Package 1');
    const task  = await ins('task', wp, 'Task 1');
    const subA  = await ins('subtask', task, 'Subtask A', 3); // weighted
    const subB  = await ins('subtask', task, 'Subtask B', 1);
    assert(!!subB, 'create WBS tree (stage→milestone→work_package→task→subtasks)');

    // ── Progress rollup (weighted): A=100·3, B=0·1 ⇒ task=75 ⇒ project=75 ──
    await client.query(`UPDATE work_items SET progress_pct=100, status='done' WHERE id=$1`, [subA]);
    await client.query(`UPDATE work_items SET progress_pct=0 WHERE id=$1`, [subB]);
    await client.query(`SELECT fn_rollup_project($1)`, [pid]);
    const val = async (id) => (await client.query(`SELECT progress_pct FROM work_items WHERE id=$1`, [id])).rows[0].progress_pct;
    assert(Number(await val(task)) === 75, `task rolls up to 75 (got ${await val(task)})`);
    assert(Number(await val(stage)) === 75, `stage rolls up to 75 (got ${await val(stage)})`);
    const projProg = (await client.query(`SELECT progress_pct FROM projects WHERE id=$1`, [pid])).rows[0].progress_pct;
    assert(Number(projProg) === 75, `project rolls up to 75 (got ${projProg})`);

    // ── Project health stub: past planned_end + incomplete ⇒ red ──────
    await client.query(`UPDATE projects SET planned_end=CURRENT_DATE-1 WHERE id=$1`, [pid]);
    const health = (await client.query(`SELECT fn_project_health($1) AS h`, [pid])).rows[0].h;
    assert(health === 'red', `health = red when overdue & incomplete (got ${health})`);

    // ── Budget status: forecast > allocated ⇒ deficit ─────────────────
    await client.query(
      `INSERT INTO project_budgets (project_id, allocated_amount, forecast_amount, actual_amount)
       VALUES ($1, 1000, 1200, 0)`, [pid]);
    const bs = (await client.query(`SELECT fn_budget_status($1) AS s`, [pid])).rows[0].s;
    assert(bs === 'deficit', `budget status = deficit when forecast>allocated (got ${bs})`);

    // ── Membership + unique constraint ────────────────────────────────
    if (uid) {
      await client.query(`INSERT INTO project_members (project_id, user_id, project_role) VALUES ($1,$2,'manager')`, [pid, uid]);
      assert(true, 'add project member');
      await expectError(
        () => client.query(`INSERT INTO project_members (project_id, user_id, project_role) VALUES ($1,$2,'manager')`, [pid, uid]),
        'duplicate (project,user,role) rejected by UNIQUE');
    }

    // ── CHECK constraints enforced ────────────────────────────────────
    await expectError(
      () => client.query(`INSERT INTO work_items (project_id, type, name) VALUES ($1,'invalid_type','x')`, [pid]),
      'invalid work_item type rejected by CHECK');
    await expectError(
      () => client.query(`INSERT INTO projects (code, name, status) VALUES ('X','Y','not_a_status')`),
      'invalid project status rejected by CHECK');

    // ── Resources + inventory movements (mirrors the movements route) ──
    const { rows: [r] } = await client.query(
      `INSERT INTO resources (project_id, name, category, unit_of_measure, quantity_required, attributes)
       VALUES ($1,'Cement','material','bags',100,'{"grade":"32.5N"}'::jsonb) RETURNING id`, [pid]);
    const rid = r.id;
    assert(!!rid, 'create resource (material with attributes)');

    // Apply a movement exactly as the route does: deltas + atomic CTE update.
    const move = async (type, qty) => {
      const { rows: [cur] } = await client.query(`SELECT quantity_available FROM resources WHERE id=$1`, [rid]);
      const avail = Number(cur.quantity_available);
      let dA = 0, dC = 0, dR = 0, dW = 0;
      if (type === 'receive') dA = qty;
      else if (type === 'consume') { dA = -qty; dC = qty; }
      else if (type === 'waste') { dA = -qty; dW = qty; }
      else if (type === 'return') { dA = qty; dR = qty; }
      else if (type === 'adjust') dA = qty - avail;
      await client.query(
        `WITH mv AS (INSERT INTO resource_movements (resource_id, movement_type, quantity) VALUES ($1,$2,$3) RETURNING id)
         UPDATE resources SET quantity_available=quantity_available+$4, quantity_consumed=quantity_consumed+$5,
           quantity_returned=quantity_returned+$6, quantity_wasted=quantity_wasted+$7, updated_at=now()
         WHERE id=$1`, [rid, type, qty, dA, dC, dR, dW]);
    };
    await move('receive', 100); await move('consume', 30); await move('waste', 5);
    await move('return', 5); await move('adjust', 60);
    const { rows: [q] } = await client.query(
      `SELECT quantity_available a, quantity_consumed c, quantity_returned r, quantity_wasted w FROM resources WHERE id=$1`, [rid]);
    assert(Number(q.a) === 60 && Number(q.c) === 30 && Number(q.w) === 5 && Number(q.r) === 5,
      `movement math: avail=60 consumed=30 wasted=5 returned=5 (got a=${q.a} c=${q.c} w=${q.w} r=${q.r})`);

    const mvCount = (await client.query(`SELECT count(*)::int n FROM resource_movements WHERE resource_id=$1`, [rid])).rows[0].n;
    assert(mvCount === 5, `5 movements recorded in ledger (got ${mvCount})`);

    await expectError(
      () => client.query(`INSERT INTO resources (project_id, name, category) VALUES ($1,'x','not_a_category')`, [pid]),
      'invalid resource category rejected by CHECK');
    await expectError(
      () => client.query(`UPDATE resources SET quantity_available = -1 WHERE id=$1`, [rid]),
      'negative quantity_available rejected by CHECK');
  } finally {
    await client.query('ROLLBACK'); // nothing persists
  }

  console.log(`\n${failed === 0 ? '✓' : '✗'} DB tests: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => client.end());
