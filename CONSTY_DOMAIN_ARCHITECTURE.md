# CONSTY — Domain Architecture & Project Operating Model

**Status:** Approved — implementation started (Phase 0 + Phase 1 spine).
**Date:** 2026-06-14
**Scope:** Map real-company project execution (construction / infrastructure / field operations / multi-resource delivery) onto the CONSTY codebase, and define the database, lifecycle, resource, budget, and blocker models required to make CONSTY a real operational system.

---

## DECISIONS (locked 2026-06-14)

- **NO ORM.** Drizzle/Prisma rejected. CONSTY is halfway built and the priority is to **ship, get users, earn revenue, then fork/refactor if needed**. Mid-flight ORM adoption over 185 raw-SQL tables would add migration risk and delay shipping for no near-term return. We continue with **raw SQL + stronger discipline** (see "Raw SQL migration discipline and schema control" below).
- **Tenancy: SINGLE-TENANT.** One company per deployment. No `org_id` on tables. Clone/fork per client later if multi-tenant is ever required. (DB is empty, so this is safe to start; revisit only when a multi-company customer appears.)
- **Project RBAC: MEMBERSHIP-GATED + ADMIN OVERRIDE.** To access a project you must be a `project_members` row; your `project_role` governs what you can do inside it. Global `superadmin`/`admin` bypass membership. This is the precedence rule the access layer must implement.

### Raw SQL migration discipline and schema control (replaces the ORM recommendation)
- Versioned, **ordered** SQL files in `database/migrations/NNNN_name.sql`.
- **Idempotent** where possible (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, guarded constraints).
- A `schema_migrations` table records what has been applied (file-based runner skips already-applied files).
- **Backup before migrate** (`pg_dump`) + **verification script** after migrate.
- Database-level integrity: **FOREIGN KEYS, NOT NULL, CHECK constraints, indexes** on every table.
- **Additive first**; no destructive change without an explicit, confirmed-safe step.
- **Integration tests** (transaction-rollback against the real DB) on the most important flows.
- Keep SQL readable, explicit, and documented.

---

## 0. The single most important finding

CONSTY is the **Jeton sales/CRM/founder-OS** with construction labels on the sidebar. Against the real project-operations model, the verdict is blunt:

- There is **no project domain**. A "project" is a `deals` row — a flat sales record. There is **no Work Breakdown Structure**, no stages, milestones, work packages, tasks, or subtasks. No progress rollup.
- There is **no resource/material/inventory model**. The old `assets` and `resources` tables were **deprecated and merged into `items`** (an asset register), which has **no quantity, unit of measure, consumption, wastage, batch, expiry, or supplier** semantics.
- Budget and money are **organization-level only**. `budgets`/`expenses`/`allocations` are not project-scoped.
- There is **no procurement flow, no suppliers, no goods-receipt/inspection, no blockers, no change orders, no quality/inspection, no project risk/issue, and no closure**.
- RBAC is **global only** — there is no per-project membership or per-project role.

**De-risking fact:** every domain table is **empty (0 rows)** except one bootstrap admin user (`deals`, `client_obligations`, `budgets`, `expenses`, `items`, `documents`, `staff` all = 0). **There is no production data to preserve.** This means the PM domain can be introduced cleanly, and obsolete Jeton tables can be repurposed, ignored, or dropped without data migration. This is a near-greenfield for the domain — exploit it now, before any data lands.

---

## 1. Domain Architecture Report — what exists, what's missing, what's wrongly modeled

### 1.1 Reusable foundations (keep and build on)

| Capability | Where it lives | Verdict |
|---|---|---|
| **Polymorphic document control** | `documents` (`entity_type`,`entity_id`,`file_url`,`current_version`,`approval_status`,`visibility`,`metadata`) + `document_links` (`document_id`,`entity_type`,`entity_id`,`relationship`) + versions/approvals/folders/permissions/tags subsystem | **Excellent.** Already supports project-scoping by setting `entity_type='project'` / `'work_item'`. Reuse directly for §12. |
| **Approval engine** | `approval_requests` (polymorphic `target_record_type`/`target_record_id`, `action_requested`, `required_authority_rank`, `escalation_path` jsonb, `payload` jsonb, replay) | **Strong & reusable.** Directly powers governance gates, change-order approval, procurement approval, budget-freeze (§9, §7, §1, §3). |
| **RBAC + authority hierarchy** | `roles`,`permissions`,`role_permissions`,`user_roles`,`staff_roles`,`authority_levels`,`departments`,`organizational_structure`; `requirePermission()` w/ authority ranks | **Reusable as the global layer.** Needs a **project-scoped layer on top** (does not exist). |
| **Money substrate** | `accounts`,`ledger`,`expenses`,`budgets`,`transfers`,`payments`,`exchange_rates`,`v_budget_utilization` | **Reusable as the ledger/cash layer.** Not project-aware — needs a project budget layer above it. |
| **People/labour pool** | `staff` (department, position, salary, manager_id, employment_type, leave_balance, review dates), `employees`, `users` | Reusable as the **labour resource pool**; no capacity/allocation across projects. |
| **Audit & accountability** | `audit_logs`,`activity_logs`,`rbac_audit_logs`,`item_activity_log` | Reusable for accountability trails. |
| **Evidence storage** | Cloudinary (`cloudinary-utils`), `media`, `documents.file_url` | Reusable for photos/receipts/evidence. |
| **PDF/report generation** | Puppeteer, `document-generation.js`, `doc-render.js`, templates | Reusable for §13 stakeholder/closure reports. |

### 1.2 Closest existing analogues (informative, but **wrongly modeled** for the domain)

| Domain need | Closest table | Why it's wrong / insufficient |
|---|---|---|
| Tasks / WBS | `client_obligations` (`deal_id`,`title`,`priority`,`status`,`assigned_to`,`due_date`,`completed_at/by`) | **Flat, single-level, deal-scoped.** No parent/child, no dependencies, no progress %, no planned-vs-actual, no stages/milestones/work-packages. Pattern is useful; structure is not the spine. |
| Project | `deals` (`title`,`status`,`stage`,`total_amount`,dates,`metadata`) | A **flat commercial record**. `stage` here = *sales* stage, not project execution stage. No governance, no WBS, no health. |
| Resources / materials | `items` (`category`,`type`,`condition`,`purchase_cost`,`current_value`,`location`,`serial_number`,`migrated_from_asset`,`migrated_from_resource`) | An **asset register**. No `quantity`, `unit_of_measure`, `quantity_consumed/returned/wasted`, `supplier`, `batch`, `expiry`, `grade`, `mass`. Cannot model consumables or inventory movement. |
| Stages | `pipeline_stages`,`pipeline_stage_history` | **Sales pipeline** stages, not project execution stages. |
| Issues | `system_issues`,`issue_root_causes`,`issue_resolutions` | **Software/system** issue tracking (tech-intelligence). Different domain from project risks/issues/blockers. Pattern only. |
| Allocation | `allocations` (`payment_id`,`resource_type`,`resource_id`,`amount`) | Allocates **payments** to categories, not budget→work or resource→task. |

### 1.3 Outright missing (no analogue at all)

Project governance roles · Work Breakdown Structure (stages→milestones→work packages→tasks→subtasks) · progress rollup · dependencies/blockers · project budgets & funding sources · committed/forecast cost · resource inventory & movement · materials intelligence (grade/batch/expiry/mass) · sister-resource relations · suppliers · procurement & goods-receipt/inspection · change orders · quality inspections/defects · project risks & issues · project-scoped documents · project health scoring · project closure / P&L.

**Conclusion:** ~85% of the real domain is absent; the ~15% that exists (documents, approvals, ledger, RBAC, audit, PDF) is **infrastructure**, not domain — exactly the right things to reuse while the domain is built on top.

---

## 2. Proposed Database Model

Design choice: a **unified work-item tree** (one `work_items` table covering stage/milestone/work_package/task/subtask) rather than five near-duplicate tables. Rationale: a single tree makes progress rollup (recursive CTE), dependencies across levels, and polymorphic attachment of evidence/approvals/budget/blockers uniform; it avoids 5× schema duplication. Trade-off: weaker per-level FK strictness — mitigated by a `type` enum + `parent_type` validation trigger. `projects` remains its own root entity.

> Notation below is a schema sketch, not final DDL. All tables carry `id uuid pk`, `created_at`, `updated_at`, `created_by`, and (if multi-tenant — see §9) `org_id`.

### 2.1 Governance & spine
```
projects(
  code, name, description, category, type[construction|infrastructure|field_ops|...],
  governor_id→users, manager_id→users, client_id→clients,
  status[draft|planning|approved|active|on_hold|frozen|closing|closed|cancelled],
  health[green|amber|red] (computed), priority, currency, location,
  planned_start, planned_end, actual_start, actual_end,
  progress_pct (rolled up, cached), budget_status (computed), metadata jsonb
)

project_members(            -- PER-PROJECT RBAC (new concept)
  project_id, user_id,
  project_role[governor|manager|stage_leader|contributor|viewer|contractor|
               client|accountant|procurement_officer|storekeeper|inspector|field_worker],
  stage_id→work_items NULL, -- stage leaders scoped to a stage
  permissions jsonb NULL,    -- optional per-member overrides
  status[active|removed]
  UNIQUE(project_id, user_id, project_role)
)

work_items(                 -- stages → milestones → work_packages → tasks → subtasks
  project_id,
  type[stage|milestone|work_package|task|subtask],
  parent_id→work_items NULL, path ltree,  -- adjacency + materialized path for rollup
  sequence, name, description,
  owner_id→users,            -- stage leader / package owner / assignee
  status[not_started|in_progress|blocked|in_review|done|cancelled],
  priority[low|medium|high|critical],
  planned_start, planned_end, actual_start, actual_end,
  progress_pct,              -- leaf: entered; branch: rolled up
  weight numeric default 1,  -- rollup weighting (by count, budget, or duration)
  is_gate boolean,           -- milestone gates that require approval to pass
  budget_amount numeric,     -- optional cost envelope at this node
  completion_notes
)

work_item_dependencies(
  predecessor_id→work_items, successor_id→work_items,
  dep_type[FS|SS|FF|SF], lag_days
)
```

### 2.2 Budget & funding
```
project_budgets(project_id, allocated_amount, currency,
  committed_amount, actual_amount, forecast_amount,  -- maintained by triggers/engine
  status[surplus|balanced|tight|deficit|frozen|overrun],  -- computed, see §5
  is_frozen boolean, freeze_reason, frozen_by)

budget_lines(project_id, work_item_id NULL, category, allocated, committed, actual, forecast)

funding_sources(project_id,
  source_type[company_wallet|client_deposit|external_funder|loan|grant|donor|
              retained_earnings|manual_external],
  amount, currency, account_id→accounts NULL, reference, status[pledged|received|spent])

-- reuse existing finance, now project-aware:
ALTER expenses ADD project_id, work_item_id, commitment_id   (nullable, additive)
commitments(project_id, work_item_id NULL, procurement_request_id NULL, amount, status[open|settled])
```

### 2.3 Resources & inventory
```
suppliers(name, contact, category, rating, lead_time_days, notes)

resources(
  project_id NULL,           -- NULL = company pool; set = project-allocated
  category[labour|staff|subcontractor|equipment|vehicle|material|tool|fuel|water|
           power|money|document|permit|reusable_asset|consumable],
  type, unit_of_measure, size, mass_kg,
  quantity_required, quantity_available, quantity_consumed, quantity_returned, quantity_wasted,
  unit_cost, total_cost (computed), currency,
  condition[new|refurbished|used|damaged|expired],
  manufacturer, supplier_id→suppliers, source, storage_location,
  attributes jsonb)         -- material intelligence: grade, batch, expiry, brand, diameter, length, litres...

resource_relations(         -- sister resources, SOFT links
  resource_id→resources, depends_on_resource_id→resources,
  relation_type[requires|consumes|operated_by|transported_by], note)

resource_allocations(resource_id, project_id NULL, work_item_id NULL, quantity_allocated, status)

resource_movements(         -- the inventory ledger
  resource_id, movement_type[receive|inspect|store|issue|transfer|consume|return|waste|adjust],
  quantity, from_location, to_location, work_item_id NULL, supplier_id NULL,
  reference, moved_by, moved_at)
```
Material-specific deep attributes live in `resources.attributes` jsonb (cement: brand/grade/bag_size/bags/expiry/batch; steel: diameter/length/weight; fuel: type/litres/price_per_litre/supplier; vehicle: vehicle_type/owner/driver/fuel_req/trips/maintenance), with a small validation layer per `category` rather than 15 sparse columns.

### 2.4 Procurement & goods-receipt
```
procurement_requests(project_id, work_item_id NULL, requested_by, status
  [requested|approved|ordered|received|inspected|stored|allocated|closed|rejected],
  approval_request_id→approval_requests NULL, supplier_id NULL, total_est_cost, currency)

procurement_request_lines(request_id, resource_id NULL, description, quantity, unit, est_unit_cost)

goods_receipts(procurement_request_id, supplier_id, received_qty, rejected_qty,
  inspection_status[pending|passed|failed], inspected_by, receipt_url, stored_to_location, received_at)
```
Flow enforced by status machine (§4.3): Request → Approval → Order → Receive → Inspect → Store → Allocate → Consume → Return/Waste.

### 2.5 Blockers, change orders, quality, risk/issue, closure
```
blockers(project_id, target_type[work_item|resource|procurement|budget],
  target_id, blocker_type ENUM(15, see §6), description, responsible_user_id,
  required_action, est_delay_days, est_cost_impact, severity[low|medium|high|critical],
  detected_by[manual|auto], status[open|in_progress|resolved], detected_at, resolved_at)

change_orders(project_id, requested_by, reason, original_scope, requested_change,
  cost_impact, time_impact_days, status[draft|submitted|approved|rejected],
  approval_request_id→approval_requests, budget_adjustment_id→budget_lines NULL,
  schedule_adjustment jsonb NULL)

inspection_checklists(project_id NULL, name) ; checklist_items(checklist_id, label, required)
inspections(project_id, work_item_id NULL, inspector_id, checklist_id NULL,
  result[pass|fail|conditional], notes, performed_at)
defects(project_id, work_item_id NULL, inspection_id NULL, description, severity,
  rework_required boolean, status[open|in_rework|closed])

risks(project_id, description, probability[1-5], impact[1-5], score (computed),
  mitigation_plan, owner_id, status[open|mitigating|closed|materialized])
project_issues(project_id, description, current_impact, owner_id, resolution_plan,
  due_date, status[open|in_progress|resolved])   -- distinct from system_issues

project_closures(project_id, final_inspection_id NULL, final_cost, remaining_materials jsonb,
  returned_assets jsonb, unresolved_issue_count, client_accepted_at, accepted_by,
  handover_doc_id→documents, lessons_learned, pnl_result numeric)
```

### 2.6 Cross-cutting reuse (no new table)
- **Documents/evidence at any level:** `documents.entity_type ∈ {project, work_item, procurement, payment, inspection, change_order}` + `document_links`.
- **Approvals at any gate:** `approval_requests.target_record_type` = the above.
- **Audit:** existing `audit_logs`/`activity_logs`.

---

## 3. Project Lifecycle Model

```
            ┌─ cancelled (terminal)
draft ─► planning ─►(sponsor approves budget = gate)─► approved ─► active ─► closing ─► closed
                                                          ▲  │
                                                   on_hold/frozen ◄─┘ (blocker/budget freeze)
```
- **draft:** scaffolding; governor/manager assigned; WBS being drafted.
- **planning:** WBS, budget, funding sources, resource plan defined. Exit gate = **sponsor approves project budget** via `approval_requests`.
- **approved → active:** execution begins; actual dates/progress recorded; resources moved; expenses booked.
- **on_hold / frozen:** triggered by critical blocker or budget freeze (`project_budgets.is_frozen`); spending paused.
- **closing:** final inspection, cost reconciliation, returns/waste accounting, client acceptance.
- **closed:** locked; `project_closures` written; P&L computed.

**Governance gates** (each = an `approval_requests` record):
1. Budget approval (planning→approved) — **governor/sponsor**.
2. Milestone gate pass (`work_items.is_gate`) — **stage leader → manager**.
3. Change-order approval — per cost/time thresholds → escalation path.
4. Closure acceptance — **client + governor**.

**Progress rollup (the core mechanic):**
```
leaf.progress           = entered by owner (or = 100 when status=done)
branch.progress         = Σ(child.progress × child.weight) / Σ(child.weight)
project.progress        = rollup of stages
```
Computed via recursive CTE on `parent_id`/`path`; cached into `progress_pct` columns and recomputed on child change (trigger or service) to keep reads cheap.

**Project health** (RAG) = weighted composite of:
`schedule variance` (planned% vs actual% to date), `budget_status`, `max open blocker severity`, `resource availability gap`, `open defect count/severity`, `overdue approvals`. Sketch:
```
health_score = w1·schedule + w2·budget + w3·(1−blocker_severity) + w4·resource_avail + w5·quality
green ≥ 0.75 ; amber 0.5–0.75 ; red < 0.5  (any critical blocker or overrun ⇒ red)
```

---

## 4. Resource Lifecycle Model

### 4.1 Resource state
```
required ─► sourced ─► received ─► inspected ─► in_store ─► allocated ─► in_use
                                       │                                   │
                                    rejected                      ┌── consumed
                                                                  ├── returned ─► in_store
                                                                  └── wasted (loss)
```
Every transition writes a `resource_movements` row (the inventory ledger); `resources.quantity_*` columns are derived from movement sums.

### 4.2 Sister-resource semantics
`resource_relations` expresses **soft** dependencies (vehicle *requires* fuel; cement *consumes* water+labour; roofing sheets *require* nails+timber+transport+labour; machine *operated_by* operator + *requires* fuel). Soft = a project can **stall** when a sister resource is missing even though the primary material is present — this is a primary input to blocker auto-diagnosis (§6).

### 4.3 Procurement → inventory flow (status machine)
```
Request → Approval → Order → Receive → Inspect → Store → Allocate → Consume → Return/Waste → Close
   │         │                  │          │                  │
 who/why  authority ranks   received_qty rejected_qty   movement to site/work_item
```
Each stage captures requester, approver, supplier, purchase cost, receipt/invoice, received/rejected qty, inspection result, storage location, consumption by work item, unused balance, returned balance, wastage.

---

## 5. Project Budget Model

A project owns its budget; the org ledger remains the cash system of record beneath it.

```
allocated  = Σ funding_sources.amount (received/pledged per policy)
committed  = Σ open commitments (approved procurement not yet paid)
actual     = Σ expenses where project_id = P
forecast   = actual + committed + estimate-to-complete(open work_items)
remaining  = allocated − actual
variance   = allocated − forecast
```

**Status derivation (computed, with margin band `m`, e.g. 10%):**
| Status | Condition |
|---|---|
| **frozen** | `is_frozen = true` (manual/approval hold) — overrides others for spend control |
| **overrun** | `actual > allocated` |
| **deficit** | `forecast > allocated` (not yet overspent, but projected to) |
| **tight** | `allocated ≥ forecast` and `variance < m × allocated` |
| **balanced** | `variance` within ±`m` band around expected cost |
| **surplus** | `allocated > forecast` and `variance > m × allocated` |

**Funding sources** are first-class (`company_wallet`, `client_deposit`, `external_funder`, `loan`, `grant`, `donor`, `retained_earnings`, `manual_external`) — essential for the "real company / church / NGO" range. Spend can be policy-gated by source (e.g., a grant restricted to certain categories).

---

## 6. Blocker / Stalling Diagnosis Model

CONSTY must answer **"why is this project stalled,"** not just "it's late."

**Blocker taxonomy (enum):** `missing_budget`, `missing_material`, `missing_sister_material`, `unavailable_labour`, `unavailable_equipment`, `transport_delay`, `supplier_delay`, `approval_delay`, `client_delay`, `design_document_issue`, `weather_external`, `quality_defect`, `rework_required`, `scope_change`, `unclear_responsibility`.

Each blocker tracks: type, description, affected `target` (work_item/stage/milestone/resource/procurement), responsible person, required action, estimated **delay impact (days)**, estimated **cost impact**, severity, resolution status.

**Auto-diagnosis engine** (derives blockers from state — the differentiator):
| Signal | Inferred blocker |
|---|---|
| work_item `planned_start < today`, no `actual_start`, predecessor not `done` | `approval_delay` / dependency stall |
| allocated resource `quantity_available < quantity_required` | `missing_material` |
| `resource_relations` sister has availability gap while primary is present | `missing_sister_material` |
| `project_budgets.status ∈ {deficit, frozen, overrun}` and open work needs spend | `missing_budget` |
| `procurement_requests` stuck in `requested`/`approved` past lead time | `supplier_delay` / `approval_delay` |
| labour resource allocation < required for active work_item | `unavailable_labour` |
| open `defects.rework_required = true` on a work_item | `rework_required` / `quality_defect` |
| `approval_requests` pending beyond SLA on a gate | `approval_delay` |

The engine proposes blockers; humans confirm/annotate. Health (§3) consumes open blocker severity.

---

## 7. Phased Implementation Roadmap

Each phase ships a usable slice **and** advances the architecture. Architectural backbone is **front-loaded** (Phase 0), not deferred.

| Phase | Name | Delivers | Key tables |
|---|---|---|---|
| **0** | **Foundation Without ORM** | Confirm tenancy (single-tenant) & project-RBAC (membership-gated + admin override); `schema_migrations` table; migration naming/order convention; backup-before-migrate script; verification script; critical DB constraints; minimal integration tests; feature-flag/hide inherited Jeton modules. **No ORM.** | schema_migrations, feature_flags |
| **1** | **Projects Spine** | Real `projects` model, `project_members` (per-project roles), `work_items` tree (stages→…→subtasks), `work_item_dependencies`, **progress rollup**, **project health stub**, real `/projects` UI, **stop treating `deals` as projects** | projects, project_members, work_items, work_item_dependencies |
| **2** | **Schedule & execution** | Planned-vs-actual dates, status machine, assignees, priorities, blockers (manual), timeline/calendar, field/progress updates | blockers, (updates) |
| **3** | **Project budget & funding** | `project_budgets`, `funding_sources`, `budget_lines`, project-scoped expenses/commitments, variance + status, freeze | project_budgets, funding_sources, budget_lines, commitments + expenses.project_id |
| **4** | **Resources & inventory** | `resources`, material intelligence (attributes), `resource_relations`, `resource_movements`, allocation to work items | resources, suppliers, resource_relations, resource_movements, resource_allocations |
| **5** | **Procurement** | Request→Approval→Order→Receive→Inspect→Store→Allocate flow, goods-receipt/inspection, supplier tracking | procurement_requests(+lines), goods_receipts |
| **6** | **Blocker auto-diagnosis + risk/issue/quality** | Diagnosis engine, risks, project issues, inspections, defects, change orders | risks, project_issues, inspections, defects, change_orders |
| **7** | **Reporting & health** | Health scoring, budget/variance/resource/procurement/blocker/stakeholder reports, printable PDFs | views + report engine |
| **8** | **Closure & P&L** | Final inspection, cost summary, returns/waste, client acceptance, handover, lessons, profit/loss | project_closures |
| **9** | **Cleanup & hardening** | Feature-flag/remove inherited modules, performance, security, seed templates | — |

---

## 8. Inherited / Irrelevant Modules — remove, hide, or feature-flag

The empty DB means low-cost cleanup. Classification:

**Remove or hard-deprecate (not in the PM domain, no reuse value):**
- Sales funnel: `prospects`, `prospect_contacts`, `proposals`, `proposal_snapshots`, `pipeline_*`, `followups` (or repurpose pipeline → *bid* pipeline only).
- `designs` / `design_*` (graphic design studio), `user_designs`.
- `pricing_*`, `subscriptions`, `subscription_*`, `offerings`, `products` (SaaS pricing/catalog).
- Tech/founder intelligence: `system_intelligence*`, `tech_stack*`, `tech_intelligence`, `systems*`, `drais_*`, `external_connections` (DRAIS), `bug_reports`, `feature_requests`, `issue_root_causes`, `issue_resolutions`, `system_issues` (software dev tracking).
- `licenses` + `license_*` (software licensing).
- `revenue_events`, `revenue_allocations`, `capital_allocation_rules` (founder finance).

**Hide / feature-flag (possible future value, not core):**
- `communication`/`calls`/`messages` (could become project chat later).
- `knowledge*` (could become project knowledge base).
- `intellectual_property`, `cloud_accounts`, `system_costs`.

**Keep & repurpose (infrastructure):**
- `documents*`, `approval_requests`, `accounts`/`ledger`/`expenses`/`budgets`/`transfers`/`payments`/`exchange_rates`, RBAC tables, `staff`/`employees`, `audit_logs`/`activity_logs`, `media`, `clients`, `departments`/`organizational_structure`, backup subsystem.

> Mechanism: a `feature flags` / module-visibility config + nav gating (the sidebar already filters by permission/module). Drop tables only after flags prove the modules are truly unused.

---

## 9. Architectural Risks (before implementation)

1. **Migration drift without discipline (highest risk).** 103 ad-hoc SQL files run by hand; schema already drifted (dump 176 vs live 185 tables). Building ~30 new related tables this way *would* produce drift and integrity bugs. **Mitigation (no ORM — per decision):** a dedicated `database/migrations/` series with a `schema_migrations`-tracked runner, ordered + idempotent files, backup-before-migrate, post-migrate verification, and DB-level constraints. Legacy `migrations/` is left untouched (already applied).
2. **Tenancy decision is now-or-never.** No `org_id` exists. Empty DB = the only cheap moment to add it. If CONSTY may ever serve multiple companies/churches/NGOs, bake `org_id` + scoping into every new table from Phase 1. Retrofitting later is a rewrite.
3. **Dual RBAC (global + per-project) complexity.** Permission checks must compose global role + `project_members` role. Define the precedence/merge rule once (recommend: project role grants within a project; global role for cross-project/admin) and centralize it.
4. **Progress-rollup performance.** Recursive CTE on every read won't scale. **Mitigation:** cache `progress_pct` on nodes, recompute on child change via trigger or a single service function; index `path`/`parent_id`.
5. **Polymorphic patterns lack FK enforcement.** `entity_type/entity_id` (documents, approvals, blockers) can orphan. **Mitigation:** validation triggers + periodic integrity checks; never rely on app code alone.
6. **DB-level integrity is weak today.** Saw `created_by` silently NULL via a `perm.userId` vs `perm.auth.userId` bug. New tables must enforce FK / NOT NULL / CHECK at the database, not just app.
7. **JavaScript, not TypeScript.** The recent 64 `no-undef` crashes are exactly the class TS prevents. A 30-table domain in untyped JS is a recurring liability. **Mitigation:** adopt TS (or `checkJs`+JSDoc) at least for the new domain and Drizzle schema.
8. **No tests / no CI gate.** Money + accountability with zero automated tests is unacceptable for a real company. **Mitigation:** integration tests on auth, project CRUD, rollup, and money flows, gated in CI from Phase 0.
9. **Unified `work_items` trade-off.** Flexibility vs per-level FK strictness — accepted, mitigated by `type` enum + parent-type validation trigger.

---

## 10. The exact first implementation phase (after this analysis)

**Phase 0 — Foundation Without ORM**, immediately followed by **Phase 1 — Projects Spine**, executed against the live Neon DB with raw SQL discipline.

**Phase 0:**
1. ✅ Confirm tenancy (single-tenant) and project-RBAC (membership-gated + admin override).
2. Create/verify `schema_migrations` table; establish `database/migrations/NNNN_name.sql` order convention.
3. Add backup-before-migrate script (`pg_dump`) and post-migrate verification script.
4. Add critical DB constraints (FK/NOT NULL/CHECK/indexes) on all new tables.
5. Add minimal integration tests (transaction-rollback) on the most important flows.
6. Feature-flag / hide irrelevant inherited Jeton modules.
7. **Do not introduce an ORM.**

**Phase 1:**
1. Create real `projects` model.
2. Create `project_members` (per-project governance roles).
3. Create `work_items` tree (stages→milestones→work_packages→tasks→subtasks).
4. Create `work_item_dependencies`.
5. Implement progress rollup (`fn_rollup_project`).
6. Implement project health stub (`fn_project_health`).
7. Build real `/app/projects` UI.
8. Stop treating `deals` as projects.

**Definition of done:** a user can create a real project, assign governor/manager/stage-leaders, build a Stage→Milestone→Work Package→Task→Subtask tree, mark progress on leaves, and watch it roll up into milestone/stage/project progress and a health indicator — all under per-project roles, on a constraint-enforced, migration-tracked schema.

---

### Appendix A — Evidence (grounding for this report)
- Live DB: 185 base tables; **all domain tables empty** (deals/client_obligations/budgets/expenses/items/documents/staff = 0 rows; 1 admin user).
- No tables matching `project|stage|milestone|task|work|resource|material|inventor|procure|purchase|supplier|stock|risk|blocker|change_order|inspect|quality|defect|closure` except sales `pipeline_*`, finance `budget*`/`allocations`, `client_obligations`, `items`/`products`, deprecated `_deprecated_assets`/`_deprecated_resources`, and software `system_issues`/`issue_*`.
- `items` carries `migrated_from_asset`/`migrated_from_resource` ⇒ assets+resources were merged into an asset register (no inventory semantics).
- `documents`(`entity_type`,`entity_id`) + `document_links` and `approval_requests`(polymorphic, authority ranks, escalation) are the two strongest reusable engines.
- Stack: Next.js 16, raw SQL via `pg` (`@/lib/db.js`), **no ORM**, 103 raw migrations, JavaScript app code, global-only RBAC.
