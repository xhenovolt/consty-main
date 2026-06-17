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

    // ── Procurement → commitment → budget bridge (mirrors the PATCH route) ──
    const { rows: [pr] } = await client.query(
      `INSERT INTO procurement_requests (project_id, title, total_est_cost, currency, status, requested_by)
       VALUES ($1,'Cement order',500,'UGX','approved',$2) RETURNING id`, [pid, uid]);
    // approve side-effect: create an open commitment
    await client.query(
      `INSERT INTO commitments (project_id, procurement_request_id, amount, currency, status, created_by)
       VALUES ($1,$2,500,'UGX','open',$3)`, [pid, pr.id, uid]);
    const openSum = async () => Number((await client.query(
      `SELECT COALESCE(SUM(amount),0) v FROM commitments WHERE project_id=$1 AND status='open'`, [pid])).rows[0].v);
    assert(await openSum() === 500, `approved request opens a 500 commitment (got ${await openSum()})`);

    // budget committed reflects open commitments (mirrors budget recompute)
    await client.query(`UPDATE project_budgets SET committed_amount=$2 WHERE project_id=$1`, [pid, await openSum()]);
    const committed = Number((await client.query(`SELECT committed_amount FROM project_budgets WHERE project_id=$1`, [pid])).rows[0].committed_amount);
    assert(committed === 500, `budget committed_amount = 500 (got ${committed})`);

    // close side-effect: settle the commitment → open total back to 0
    await client.query(`UPDATE commitments SET status='settled' WHERE procurement_request_id=$1`, [pr.id]);
    assert(await openSum() === 0, `closing settles the commitment (open now ${await openSum()})`);

    await expectError(
      () => client.query(`INSERT INTO procurement_requests (project_id, title, status) VALUES ($1,'x','not_a_status')`, [pid]),
      'invalid procurement status rejected by CHECK');

    // ── Blocker auto-diagnosis (mirrors the diagnose engine) ───────────
    // resource `rid` is a material short 60<100 → missing_material expected.
    const detectMissing = `INSERT INTO blockers (project_id,target_type,target_id,blocker_type,description,severity,detected_by,status)
      SELECT $1,'resource',r.id,'missing_material','short','high','auto','open' FROM resources r
      WHERE r.project_id=$1 AND r.category IN ('material','consumable','fuel','water','power') AND r.quantity_available < r.quantity_required
      AND NOT EXISTS (SELECT 1 FROM blockers b WHERE b.project_id=$1 AND b.target_type='resource' AND b.target_id=r.id AND b.blocker_type='missing_material' AND b.status<>'resolved')`;
    const d1 = (await client.query(detectMissing, [pid])).rowCount;
    assert(d1 === 1, `diagnosis detects 1 missing_material blocker (got ${d1})`);
    const d2 = (await client.query(detectMissing, [pid])).rowCount;
    assert(d2 === 0, `diagnosis is idempotent — no duplicate (got ${d2})`);

    // restock → re-run resolver → blocker auto-resolves
    await client.query(`UPDATE resources SET quantity_available = quantity_required WHERE id=$1`, [rid]);
    const resolved = (await client.query(
      `UPDATE blockers b SET status='resolved', resolved_at=now()
       WHERE b.project_id=$1 AND b.detected_by='auto' AND b.status<>'resolved' AND b.blocker_type='missing_material'
       AND NOT EXISTS (SELECT 1 FROM resources r WHERE r.id=b.target_id AND r.quantity_available < r.quantity_required)`, [pid])).rowCount;
    assert(resolved === 1, `restock auto-resolves the blocker (got ${resolved})`);

    await expectError(
      () => client.query(`INSERT INTO blockers (project_id, blocker_type) VALUES ($1,'not_a_type')`, [pid]),
      'invalid blocker_type rejected by CHECK');

    // ── Risk score (generated), issue, defect ─────────────────────────
    const { rows: [risk] } = await client.query(
      `INSERT INTO risks (project_id, description, probability, impact) VALUES ($1,'Rain delay',4,5) RETURNING score`, [pid]);
    assert(Number(risk.score) === 20, `risk score generated = probability×impact = 20 (got ${risk.score})`);
    await expectError(
      () => client.query(`INSERT INTO risks (project_id, description, probability) VALUES ($1,'x',9)`, [pid]),
      'risk probability out of 1–5 rejected by CHECK');

    const { rows: [iss] } = await client.query(
      `INSERT INTO project_issues (project_id, description) VALUES ($1,'Access road blocked') RETURNING status`, [pid]);
    assert(iss.status === 'open', `new issue defaults to open (got ${iss.status})`);

    const { rows: [def] } = await client.query(
      `INSERT INTO defects (project_id, description, severity, rework_required) VALUES ($1,'Honeycomb in slab','high',true) RETURNING status, rework_required`, [pid]);
    assert(def.status === 'open' && def.rework_required === true, 'defect logged (open, rework_required)');

    // ── Change order budget effect (mirrors approve → contingency line) ─
    await client.query(`INSERT INTO budget_lines (project_id, category, allocated) VALUES ($1,'materials',1000)
                        ON CONFLICT (project_id,category) DO UPDATE SET allocated=1000`, [pid]);
    await client.query(`SELECT fn_recompute_budget($1)`, [pid]);
    const allocBefore = Number((await client.query(`SELECT allocated_amount FROM project_budgets WHERE project_id=$1`, [pid])).rows[0].allocated_amount);
    await client.query(`INSERT INTO change_orders (project_id, title, cost_impact, status) VALUES ($1,'Extra rebar',200,'submitted')`, [pid]);
    await client.query(`INSERT INTO budget_lines (project_id, category, allocated) VALUES ($1,'contingency',200)
                        ON CONFLICT (project_id,category) DO UPDATE SET allocated=budget_lines.allocated+200`, [pid]);
    await client.query(`SELECT fn_recompute_budget($1)`, [pid]);
    const allocAfter = Number((await client.query(`SELECT allocated_amount FROM project_budgets WHERE project_id=$1`, [pid])).rows[0].allocated_amount);
    assert(allocAfter === allocBefore + 200, `approving change order raises allocated by cost_impact via lines (${allocBefore}→${allocAfter})`);
    await expectError(
      () => client.query(`INSERT INTO change_orders (project_id, title, status) VALUES ($1,'x','not_a_status')`, [pid]),
      'invalid change_order status rejected by CHECK');

    // ── Closure → project closed (mirrors accept) ────────────────────
    await client.query(
      `INSERT INTO project_closures (project_id, final_cost, pnl_result, status, client_accepted_at, accepted_by)
       VALUES ($1,0,0,'closed',now(),$2)
       ON CONFLICT (project_id) DO UPDATE SET status='closed', client_accepted_at=now()`, [pid, uid]);
    await client.query(`UPDATE projects SET status='closed', actual_end=CURRENT_DATE WHERE id=$1`, [pid]);
    const pstatus = (await client.query(`SELECT status FROM projects WHERE id=$1`, [pid])).rows[0].status;
    assert(pstatus === 'closed', `accepting closure closes the project (got ${pstatus})`);
    await expectError(
      () => client.query(`INSERT INTO project_closures (project_id, final_cost) VALUES ($1, 0)`, [pid]),
      'one closure per project enforced by UNIQUE');

    // ── Dashboard aggregation (mirrors /api/dashboard/projects) ──────
    // Fresh project with one open critical blocker + one short resource.
    const { rows: [dp] } = await client.query(
      `INSERT INTO projects (code,name,type,status,created_by) VALUES ($1,'Dash','construction','active',$2) RETURNING id`,
      [`DASH-${Date.now()}`, uid]);
    await client.query(`INSERT INTO blockers (project_id,blocker_type,severity,status,detected_by) VALUES ($1,'missing_budget','critical','open','auto')`, [dp.id]);
    await client.query(`INSERT INTO resources (project_id,name,category,quantity_required,quantity_available) VALUES ($1,'Sand','material',50,10)`, [dp.id]);
    const stalled = Number((await client.query(
      `SELECT count(DISTINCT project_id)::int n FROM blockers WHERE project_id=ANY($1::uuid[]) AND status<>'resolved' AND severity IN ('high','critical')`, [[dp.id]])).rows[0].n);
    assert(stalled === 1, `dashboard: stalled-project aggregate counts 1 (got ${stalled})`);
    const shortages = Number((await client.query(
      `SELECT count(*)::int n FROM resources WHERE project_id=ANY($1::uuid[]) AND quantity_available < quantity_required`, [[dp.id]])).rows[0].n);
    assert(shortages === 1, `dashboard: resource-shortage aggregate counts 1 (got ${shortages})`);

    // ── Category budget model: allocate, expense → actual, forecast derived ─
    await client.query(`INSERT INTO budget_lines (project_id, category, allocated) VALUES ($1,'materials',5000)
                        ON CONFLICT (project_id,category) DO UPDATE SET allocated=5000`, [dp.id]);
    const { rows: [acct] } = await client.query(`INSERT INTO accounts (name, type) VALUES ('Test Cash','cash') RETURNING id`);
    await client.query(`INSERT INTO expenses (project_id, account_id, amount, currency, category, description, created_by) VALUES ($1, $2, 1500, 'UGX', 'materials', 'Cement purchase', $3)`, [dp.id, acct.id, uid]);
    await client.query(`SELECT fn_recompute_budget($1)`, [dp.id]);
    const actual = Number((await client.query(`SELECT actual_amount FROM project_budgets WHERE project_id=$1`, [dp.id])).rows[0].actual_amount);
    assert(actual === 1500, `expense rolls into derived budget actual (got ${actual})`);
    // forecast is DERIVED: actual(1500) + committed(0) + ETC(3500) = 5000
    const matLine = (await client.query(`SELECT actual, forecast FROM budget_lines WHERE project_id=$1 AND category='materials'`, [dp.id])).rows[0];
    assert(Number(matLine.actual) === 1500 && Number(matLine.forecast) === 5000, `materials line: actual=1500, derived forecast=5000 (got a=${matLine.actual} f=${matLine.forecast})`);
    const rollup = (await client.query(
      `SELECT pb.actual_amount FROM projects p JOIN project_budgets pb ON pb.project_id=p.id WHERE p.id=ANY($1::uuid[])`, [[dp.id]])).rows;
    assert(rollup.length === 1 && Number(rollup[0].actual_amount) === 1500, 'project budget appears in finance rollup with actual=1500');

    // ── Procurement line identity + per-category commitments ──────────
    const { rows: [req2] } = await client.query(
      `INSERT INTO procurement_requests (project_id, title, budget_category, requested_by) VALUES ($1,'Foundation','materials',$2) RETURNING id`, [pid, uid]);
    await client.query(
      `INSERT INTO procurement_request_lines (request_id, item_name, specification, quantity, unit, est_unit_cost, budget_category)
       VALUES ($1,'Cement','Tororo PPC 32.5R',200,'Bags',42000,'materials'),
              ($1,'Rebar','Y12 Steel',80,'Pieces',35000,'materials'),
              ($1,'Mixer hire','Petrol',1,'Day',150000,'equipment')`, [req2.id]);
    const cement = (await client.query(`SELECT est_total FROM procurement_request_lines WHERE request_id=$1 AND item_name='Cement'`, [req2.id])).rows[0];
    assert(Number(cement.est_total) === 200 * 42000, `line est_total generated = qty×unit_cost (got ${cement.est_total})`);

    // approve side-effect (mirror route): one commitment per budget category
    await client.query(
      `INSERT INTO commitments (project_id, procurement_request_id, amount, currency, status, budget_category, created_by)
       SELECT $1,$2,COALESCE(SUM(est_total),0),'UGX','open',COALESCE(budget_category,'other'),$3
         FROM procurement_request_lines WHERE request_id=$2 GROUP BY COALESCE(budget_category,'other')`, [pid, req2.id, uid]);
    const cats = (await client.query(`SELECT budget_category, amount FROM commitments WHERE procurement_request_id=$1`, [req2.id])).rows;
    assert(cats.length === 2, `approve creates one commitment per category (got ${cats.length})`);
    const mat = cats.find(c => c.budget_category === 'materials');
    assert(mat && Number(mat.amount) === 200 * 42000 + 80 * 35000, `materials commitment = Σ materials lines (got ${mat?.amount})`);
    await expectError(
      () => client.query(`INSERT INTO procurement_request_lines (request_id, item_name, budget_category) VALUES ($1,'x','not_a_category')`, [req2.id]),
      'invalid line budget_category rejected by CHECK');

    // ── Resource catalog reuse ────────────────────────────────────────
    const { rows: [ci] } = await client.query(
      `INSERT INTO resource_catalog (name, category, unit_of_measure, default_unit_cost) VALUES ('Cement','material','bags',42000) RETURNING id`);
    assert(!!ci.id, 'create reusable catalog item');
    await client.query(`INSERT INTO resources (project_id, name, category, catalog_item_id, quantity_required) VALUES ($1,'Cement','material',$2,100)`, [dp.id, ci.id]);
    const linked = (await client.query(`SELECT count(*)::int n FROM resources WHERE catalog_item_id=$1`, [ci.id])).rows[0].n;
    assert(linked === 1, `project resource links to catalog item (got ${linked})`);
    await expectError(
      () => client.query(`INSERT INTO resources (project_id, name, category, catalog_item_id) VALUES ($1,'x','material','00000000-0000-0000-0000-000000000000')`, [dp.id]),
      'invalid catalog_item_id rejected by FK');
    await expectError(
      () => client.query(`INSERT INTO resource_catalog (name, category) VALUES ('x','not_a_category')`),
      'invalid catalog category rejected by CHECK');
  } finally {
    await client.query('ROLLBACK'); // nothing persists
  }

  console.log(`\n${failed === 0 ? '✓' : '✗'} DB tests: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => client.end());
