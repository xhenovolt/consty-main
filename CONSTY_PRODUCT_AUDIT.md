# CONSTY Product & Route Audit — CRM-to-Project-OS

**Status:** Audit only — no implementation in this document.
**Date:** 2026-06-16
**Constraint:** No ORM. Continue raw SQL with migration discipline, constraints, verification scripts, and tests.

> **Reading note (current reality):** Several domain pieces the brief assumes are "phantom" were built in the recent project-OS work and now read real, project-scoped data: the **project detail page** (`/app/projects/[id]`) has 10 working tabs; **project budgets**, **resources/inventory movements**, **procurement with line items**, **blockers + auto-diagnosis**, **risk/quality**, and a **computed closeout** all exist under `/api/projects/[id]/*`. What remains broken is exactly what this audit targets: the **inherited CRM shell around that spine** — sidebar, dashboard, finance/budgets bridge, resource reuse, and document/item consolidation. Where the brief and the code disagree, the code is described as-is.

---

## 0. Executive verdict

CONSTY today is **a real project spine bolted inside a Jeton CRM shell.** The spine (`/app/projects/*`) is sound. The shell — sidebar groups, the dashboard, `finance/budgets`, and the items/products/media/resources sprawl — still behaves like a sales/company OS and, critically, **does not read from the project domain.** Three disconnects are confirmed in code:

1. **Dashboard is pure CRM.** `/api/dashboard` queries `deals` (10×), `prospects` (6×), `followups`, `payments`, `systems`, `clients`, `budgets`. It references **zero** of `projects`, `project_budgets`, `work_items`, `blockers`, `procurement_requests`, `resources`.
2. **Budget is two disconnected worlds.** `/app/finance/budgets → /api/budgets → v_budget_utilization` (over the org-level `budgets` table). The real `project_budgets` table is referenced **only** by `/api/projects/[id]/*`. No bridge ⇒ project budgets are invisible in Finance.
3. **"Project Pipeline" is the sales funnel.** Its children point at `/app/pipeline`, `/app/prospects` (Leads), `/app/proposals` (Bids), `/app/followups`, `/app/clients` — CRM prospecting mislabeled as project execution.

Plus structural sprawl: **5 overlapping "thing" routes** (`/app/items` = asset register, `/app/products` = "Materials" catalog, `/app/assets`, `/app/resources`, `/app/media`) and **no reusable resource catalog** (project resources are `project_id`-local; materials are re-created per project).

---

## 1. Sidebar & Navigation Audit

### Route classification table

| Route | Label today | Real nature | Verdict |
|---|---|---|---|
| `/app/dashboard` | Dashboard | CRM/sales metrics | **Keep + REBUILD** (project portfolio) |
| `/app/projects`, `/app/projects/[id]` | Projects / All Projects | Real PM spine | **Keep (promote to top)** |
| `/app/pipeline` | Bid Pipeline | Sales pipeline stages | **Hide → Business Development** |
| `/app/prospects` | Leads | CRM prospects | **Hide → Business Development** |
| `/app/proposals` | Bids & Proposals | CRM proposals | **Hide → Business Development** |
| `/app/followups` | Follow-ups | CRM touchpoints | **Hide → Business Development** |
| `/app/sales` | (in routes) | CRM sales | **Hide/Delete** |
| `/app/deals` | (legacy "All Projects") | CRM deals — superseded by `/app/projects` | **Deprecate** |
| `/app/clients` | Clients | Real stakeholders | **Keep, relocate** (under Projects/Stakeholders) |
| `/app/obligations` | Site Tasks | `client_obligations` (deal deliverables) | **Merge → work_items** (deprecate route) |
| `/app/payments` | Payments | Client payments (CRM billing) | **Hide → Business Development** |
| `/app/invoices` | Invoices | Invoices (CRM billing) | **Hide → Business Development** |
| `/app/allocations` | Budget Allocations | `allocations` (payment→category) | **Deprecate** (replaced by project budget lines) |
| `/app/services` | Services | CRM service catalog | **Hide/Delete** |
| `/app/systems`, `/app/licenses`, `/app/system-costs` | Sites & Systems | Jeton SaaS infra | **Delete/deprecate** |
| `/app/operations` | Operations Log | Jeton ops log | **Repurpose → Field Log** or hide |
| `/app/products` | Materials | `products` (CRM catalog) | **Replace → Resource Catalog** |
| `/app/items` | Items | `items` (asset register) | **Merge → Resource Catalog / Inventory** |
| `/app/assets` | (route) | overlaps items | **Merge → Inventory** |
| `/app/resources` | (standalone) | thin/empty; real resources are project-scoped | **Delete standalone** (resources live in project + catalog) |
| `/app/offerings` | Offerings | CRM package catalog | **Hide/Delete** |
| `/app/media` | Media | `media` files | **Merge → Documents** |
| `/app/staff` | Team Members | Staff/people | **Keep → Team** |
| `/app/org-hierarchy` | Org Hierarchy | Org tree | **Keep → Team** |
| `/app/control-tower` | Control Tower | Founder cross-view | **Repurpose → Portfolio** or hide |
| `/app/knowledge`, `/app/docs` | Knowledge Base / Docs | Knowledge articles | **Merge → Knowledge Base** |
| `/app/admin/documents/*` | Organization Documents | Document system | **Keep → Documents** (project-scope) |
| `/app/documents` | (Intelligence→Documents) | duplicate doc center | **Merge → Documents** |
| `/app/liabilities` | Liabilities | Finance | **Move → Finance** |
| `/app/finance/*` | Finance | Company finance | **Keep (company-level)** |
| `/app/reports` | Reports | generic reports | **Keep + REBUILD** (project reports) |
| `/app/intelligence`, `/app/tech-intelligence`, `/app/financial-intelligence`, `/app/issue-intelligence` | Intelligence | Company/sales intelligence | **Delete/deprecate** (flagged off) |
| `/app/decision-log` | Decision Log | company | **Hide** |
| `/app/designs` | Designs | design studio | **Delete** (flagged off) |
| `/app/pricing`, `/app/subscriptions` | Pricing | SaaS billing | **Delete** (flagged off) |
| `/app/hrm`, `/app/hr` | HRM | HR | **Hide** (staff covers Team) |
| `/app/command-center` | Command Center | founder OS | **Hide** |
| DRAIS (`/app/dashboard/drais/*`) | DRAIS Control | external platform | **Delete** (flagged off) |
| `/app/admin/*` | Admin | RBAC/admin | **Keep** |
| `/app/approval-pipeline`, `/app/admin/approvals` | Approvals | approvals | **Keep → Approvals** (consolidate) |
| `/app/settings`, `/app/profile`, `/app/notifications`, `/app/communication`, `/app/activity` | — | platform | **Keep** |

### Action lists
- **Keep:** Dashboard, Projects, Finance (company), Documents (admin/documents), Reports, Team (staff/org-hierarchy), Approvals, Admin, Settings/Profile/Notifications/Messages/Activity, Knowledge Base, Clients.
- **Rename:** Project Pipeline→**Business Development** (hidden); Materials(`/app/products`)→**Resource Catalog**; Items→**Inventory**; Docs(`/app/docs`)→**Knowledge Base**; Organization Documents→**Documents**; Operations Log→**Field Log**.
- **Merge:** items + products + assets + standalone resources → **Resource Catalog + Inventory**; media → **Documents**; `/app/documents` + Organization Documents → **Documents**; knowledge + docs → **Knowledge Base**; approval-pipeline + admin/approvals → **Approvals**.
- **Hide / feature-flag:** Business Development (pipeline/prospects/proposals/followups/payments/invoices/sales/deals), Sites & Systems, Offerings, Services, Operations, HRM/HR, Command Center, Control Tower, Decision Log. (Designs/Pricing/Intelligence/DRAIS already flagged off.)
- **Delete/deprecate (after confirmation, no data):** designs, pricing/subscriptions, *intelligence, systems/licenses/system-costs, DRAIS, offerings, allocations, deals/obligations once migrated.

### Final proposed CONSTY sidebar (project-first)
```
DELIVER
  Dashboard            /app/dashboard          (project portfolio)
  Projects             /app/projects
  Approvals            /app/approvals

RESOURCES
  Resource Catalog     /app/catalog            (reusable master catalog)
  Inventory            /app/inventory          (stock + movements)
  Procurement          /app/procurement        (cross-project queue)

RECORDS
  Documents            /app/documents          (files/receipts/photos/approvals/reports/templates)
  Reports              /app/reports            (project reports & summaries)
  Knowledge Base       /app/knowledge

FINANCE (company-level)
  Overview / Accounts / Ledger / Expenses / Transfers / Company Budgets / Banking

ORGANISATION
  Team                 /app/staff (+ Org Hierarchy)
  Clients              /app/clients

ADMIN
  Users / Roles / Departments / Audit / Backups / Settings

— hidden unless enabled —
  Business Development (pipeline, prospects, proposals, follow-ups, payments, invoices)
```

---

## 2. Project "Pipeline" Audit

**Finding:** "Project Pipeline" is **100% CRM**. Children: `/app/pipeline` (sales pipeline + `pipeline_stages`/`pipeline_stage_history`), `/app/prospects` (Leads), `/app/proposals` (Bids), `/app/followups`, `/app/clients`. None of it is project execution.

**Recommendation:** Remove "Project Pipeline" as a label. Relocate its contents to a **hidden "Business Development"** module (a construction firm does bid for work, so don't delete — flag off by default via `module.sales_pipeline`, already seeded `false`). Build a **real project pipeline** = the project status lifecycle (already enforced by the `projects.status` CHECK): `draft → planning → approved → active → on_hold/frozen → closing → closed (+ cancelled)`.

**Real project-pipeline metrics (all queryable today):**
| Metric | Query basis |
|---|---|
| Projects by status | `projects GROUP BY status` |
| Awaiting approval | `status='planning'` (gate pending) |
| Active | `status='active'` |
| Delayed | `planned_end < today AND status NOT IN (closed,cancelled) AND progress<100` |
| Stalled | `EXISTS open blocker` (severity high/critical) |
| Budget-deficit | `project_budgets.status IN (deficit,frozen,overrun)` |
| Procurement-delayed | `procurement_requests overdue` (needed_by < today, not received) |
| Near closeout | `status='closing'` or progress ≥ 95% |

---

## 3. Project Detail Route Audit (`/app/projects/[id]`)

**Current tabs (all real, project-scoped via the same `project_id`):** Overview · Work (WBS stages→subtasks + rollup) · Budget · Resources · Procurement · Blockers · Risk · Quality · Closeout · Team.

| Brief's target tab | Status | Note |
|---|---|---|
| Overview | ✅ real | governance, dates, budget, counts |
| Work Breakdown / Tasks | ✅ real | `work_items` tree + rollup |
| Timeline | ⚠️ partial | dates exist; no Gantt view yet |
| Team | ✅ real | `project_members` |
| Budget | ✅ real | `project_budgets` + funding + computed status |
| Resources | ✅ real | `resources` + movements |
| Procurement | ✅ real (thin lines) | see §4 |
| Documents | ❌ missing tab | docs exist org-level; not surfaced per project |
| Issues / Blockers | ✅ real | blockers + auto-diagnosis; issues under Risk |
| Quality | ✅ real | inspections + defects |
| Change Orders | ✅ real | under Closeout tab |
| Reports | ❌ missing | no per-project report/print |
| Closeout | ✅ real (computed) | not phantom — computes from real data |
| Activity | ❌ missing tab | `audit_logs` exist; not surfaced per project |

**Gaps to close:** add **Documents**, **Activity**, **Reports/print**, and a **Timeline** view as project-scoped tabs reading the existing tables (`documents.entity_type='project'`, `audit_logs`, etc.). No phantom sections currently; the risk is *missing* connected tabs, not fake ones.

---

## 4. Procurement Audit & Rebuild Design

**Current state:** `procurement_requests` + `procurement_request_lines` + `goods_receipts` exist; the create modal **does** support multiple line items (description/qty/unit/est_unit_cost) with a live total; approve→opens a `commitment` (feeds budget); receipts advance status. **So multi-line works** — but lines are **under-structured and disconnected**:
- Lines are free-text `description` only; missing **category, type, specification, UoM, preferred supplier, urgency, required date, linked work item, notes** at the line level.
- Lines do **not** link to a resource catalog (no catalog yet) → vague sourcing, no reuse.
- Approved lines do **not** convert into `resource_allocations` / `resources` / `resource_movements`; `goods_receipts` are recorded but **not posted to inventory**.

**Required rebuild:**
- **Enrich `procurement_request_lines`** (additive columns): `catalog_item_id`, `category`, `type`, `specification`, `unit_of_measure`, `preferred_supplier_id`, `urgency`, `required_date`, `work_item_id`, `notes`. Keep `quantity`, `est_unit_cost`; add generated/derived `est_total`.
- **Request header** already has project_id/requested_by/status/total/supplier; add `reason`, `budget_impact` (computed), `approval_status` (via `approval_requests`), and **attachments** (via `documents`).
- **Modal**: add/remove lines (done) **+ per-line catalog typeahead** (search catalog + prior project resources; pick existing or create new catalog item), per-line spec/UoM/supplier/required-date/work-item, auto-total.
- **Conversion**: on **approve** → reserve budget (commitment ✓) **and** create `resource_allocations`; on **goods receipt** → create `resource_movements` (`receive`) into the linked resource and update quantities. Close the procurement→inventory loop.

---

## 5. Budget & Finance Audit & Rebuild Design

**Root cause of "finance/budgets shows nothing":** **table + route mismatch.** `/app/finance/budgets` → `/api/budgets` → `SELECT * FROM v_budget_utilization` (a view over the **org `budgets` table**) and `INSERT INTO budgets`. The real project budgets live in **`project_budgets`**, touched only by `/api/projects/[id]/budget`. The two never meet. It is **not** a UI bug — it's a data-model split.

**Separation to enforce:**
| Layer | Tables | Where |
|---|---|---|
| Company finance | `accounts`, `ledger`, `transfers`, `budgets` (overhead), `expenses` (org) | `/app/finance/*` |
| Project budget | `project_budgets` (allocated/committed/actual/forecast/status), `funding_sources`, `budget_lines`, `commitments` | project Budget tab |
| Project spend | `expenses.project_id`, `commitments` | project Budget tab |

**Rebuild:**
- Add a **"Project Budgets" view in Finance** (rollup): `SELECT` across `project_budgets` joined to `projects` (allocated/actual/committed/forecast/variance/status per project) — read-only portfolio finance. Keep company `budgets` as a separate "Company/Overhead Budgets" tab. **Do not merge the tables**; surface both.
- Project budget already answers the mental-model questions (allocated / funding sources / committed / actual / forecast / status / which work items via `budget_lines.work_item_id` / which procurement via `commitments.procurement_request_id`). The missing piece is **expenses entry per project** (a "log project expense" action writing `expenses.project_id` + optional `work_item_id`/`budget_line_id`) and **budget-line consumption** display.
- **Upgrade `fn_project_health`** to consume budget status + open-blocker severity (still the Phase-1 stub).

---

## 6. Closeout Audit & Rebuild Design

**Current state:** **Not phantom.** `/api/projects/[id]/closure` GET **computes from real data**: final cost (`SUM expenses.project_id`), funding (`SUM funding_sources`), P&L, unresolved (`open project_issues + open blockers`), remaining materials (`resources` with `quantity_available>0`), returned assets (`is_reusable AND quantity_returned>0`); PUT upserts + `accept=true` sets the project to `closed`.

**Gaps vs the full close-out report:**
- Missing in the computed summary: **committed spend**, **remaining budget balance**, **surplus/deficit label**, **consumed vs wasted materials breakdown**, **defects/rework status**, **final documents list**, **final inspection link**.
- **Rebuild as a fuller computed report:** extend `computeSummary()` to add committed (`SUM open commitments`), remaining (`allocated − actual`), variance + status (from `project_budgets`), consumed/wasted material totals (`resources.quantity_consumed/_wasted`), open defect/rework count (`defects`), linked documents (`documents.entity_type='project'`), and `final_inspection_id`. Generate a **printable closure PDF** via the existing Puppeteer pipeline. Keep acceptance/handover (already wired).

---

## 7. Resources, Materials & Reusability Audit & Rebuild Design

**Current problem (confirmed):** resources are **`project_id`-local** (`resources.project_id NOT NULL` in practice via the project routes); there is **no master catalog**; `/app/items` (`items` asset register), `/app/products` ("Materials" CRM catalog), `/app/assets`, `/app/media`, and standalone `/app/resources` overlap. Material created in one project does **not** help another → duplicates.

**Required model:**

**A. Master Catalog (new table `resource_catalog`)** — reusable definitions: `name, category, type, unit_of_measure, specification, manufacturer, default_supplier_id, default_unit_cost, attributes jsonb` (size/mass/grade/batch rules/fuel type). One row per real-world material/equipment/labour type, company-wide.

**B. Project allocation (extend existing `resources`)** — add `catalog_item_id uuid REFERENCES resource_catalog`. Project `resources` becomes "this project's instance of a catalog item," keeping the per-project quantities (required/allocated/consumed/returned/wasted), actual unit cost, supplier, status, `work_item_id`. (Reuses the table already built.)

**C. Suggestion/search** — a `/api/catalog?search=` typeahead: search `resource_catalog` + previously-used project `resources`; suggest matches; pick existing (sets `catalog_item_id`) or create a new catalog item inline; **prevent duplicates** by surfacing near-matches before create.

**D. Inventory/movement ledger** — already exists (`resource_movements`: receive/store/allocate/transfer/consume/return/waste/adjust). Add a **company-level Inventory view** that aggregates stock across projects/catalog. Migrate `/app/items` data into `resource_catalog`/inventory; retire `/app/products` & `/app/assets`.

---

## 8. Items / Media / Documents / Documentation Merge Plan

| Today | Concept | Target |
|---|---|---|
| `/app/items` | asset register (`items`) | **Inventory** + seed **Resource Catalog** |
| `/app/products` | "Materials" CRM catalog | **delete** (→ Resource Catalog) |
| `/app/assets` | assets | **Inventory** |
| `/app/resources` (standalone) | thin | **delete** (resources live in project + catalog) |
| `/app/media` | media files | **merge → Documents** |
| `/app/admin/documents/*` | document system | **Documents** (add project scope) |
| `/app/documents` (Intelligence dup) | duplicate | **delete** (→ Documents) |
| `/app/docs` + `/app/knowledge` | knowledge | **merge → Knowledge Base** |

**Documents page (target) tabs:** All Documents · Project Files · Receipts & Invoices · Photos / Evidence · Approvals · Reports · Templates — all backed by `documents` (`entity_type`,`entity_id`,`category`) + `document_links`, filterable by project. **"Documentation" becomes "Project Reports / Summaries"** (generated summaries via the report engine), distinct from uploaded Documents.

**Exact sidebar labels:** `Resource Catalog`, `Inventory`, `Documents`, `Reports`, `Knowledge Base`.

---

## 9. Dashboard Analytics Design

**Current:** `/api/dashboard` = CRM (`deals`, `prospects`, `followups`, `payments`, `systems`, `clients`). **Replace wholesale** with project queries (all real, no fake):

- **Portfolio:** total / active / delayed / stalled / by-status / health distribution (`projects`, `blockers`).
- **Budget:** total allocated / actual / committed / forecast / variance; surplus vs deficit project counts (`project_budgets`).
- **Procurement:** pending approval, overdue (`procurement_requests`).
- **Resources:** shortage count (`resources` where available<required), top shortages.
- **Execution:** overdue work items, upcoming milestones (`work_items`), work-completion trend, progress chart, budget-burn chart (`expenses.project_id` over time), resource-usage chart (`resource_movements`).
- **Blockers:** top open blockers by severity.
- **Closeout-ready:** `status='closing'` or progress ≥95%.
- **Activity:** recent `audit_logs` for project entities.

Each card = one SQL query against the project domain. Use `recharts` (already a dependency).

---

## 10. Broken Data-Flow Map

| Broken flow | Cause | Fix |
|---|---|---|
| `finance/budgets` shows no project budgets | route→`/api/budgets`→`v_budget_utilization`/`budgets` (org); `project_budgets` separate | add Project-Budgets rollup view in Finance |
| Dashboard ignores projects | `/api/dashboard` queries `deals/prospects/...` | rebuild against project domain |
| Materials re-created per project | no `resource_catalog`; `resources.project_id`-local | add catalog + `catalog_item_id` FK + typeahead |
| Approved procurement ↛ inventory | no conversion; `goods_receipts` not posted | approve→`resource_allocations`; receipt→`resource_movements` |
| Procurement lines vague | lines = free-text description only | enrich line columns + catalog link |
| Documents not project-scoped in UI | `documents.entity_type` exists but UI is org-level | project Documents tab filtering by `entity_id` |
| Project expenses can't be logged | `expenses.project_id` exists, no UI | "log project expense" action |
| Closeout missing committed/variance/defects | `computeSummary` partial | extend computed report |
| `obligations`/`deals`/`allocations` parallel to real spine | legacy CRM tables still nav-linked | migrate to `work_items`/`projects`/`budget_lines`, deprecate |
| Duplicate item/media/doc routes | inherited sprawl | merges in §8 |

**Missing FKs/columns to add (additive):** `resources.catalog_item_id`, `procurement_request_lines.{catalog_item_id, work_item_id, preferred_supplier_id, category, type, specification, unit_of_measure, urgency, required_date}`, `expenses.budget_line_id` (FK already? verify), `documents` project filter index on `(entity_type, entity_id)`.

---

## 11. Implementation Roadmap (raw SQL, no ORM)

> Discipline for every phase: numbered `database/migrations/NNNN_*.sql` (idempotent), `pg_dump` backup-before-migrate, `verify-schema.mjs` after, DB-level FK/NOT NULL/CHECK, and `test:db` integration coverage. Additive first; deprecate (don't drop) until confirmed.

| Phase | Scope | Key risks | Definition of Done |
|---|---|---|---|
| **0 — Navigation reset** | Rebuild `navigation-config.js` to the §1 sidebar; feature-flag Business Development + inherited modules; fix mislabels; merge duplicate entries | Hiding a route a user relied on | New project-first sidebar renders; no CRM labels visible by default; every visible route is PM-relevant; build green |
| **1 — Project detail spine completion** | Add Documents, Activity, Reports, Timeline tabs (read existing tables, same `project_id`); remove any phantom | Over-scoping Gantt | All tabs read project-scoped data; no section without a real query |
| **2 — Procurement rebuild** | Enrich line items (catalog link, specs, supplier, work item, required date); approve→allocations; receipt→movements | Migration on `procurement_request_lines`; conversion double-posting | Multi-line request with per-line specs; approved lines reserve budget + allocate; receipts post to inventory; tests |
| **3 — Budget/finance bridge** | Project-Budgets rollup in Finance; project expense logging; budget-line consumption; upgrade `fn_project_health` | Confusing company vs project budgets | finance shows project budgets (read-only rollup) **and** company budgets separately; project expense writes `project_id`; health reflects budget+blockers |
| **4 — Resource catalog & reuse** | `resource_catalog` table; `resources.catalog_item_id`; `/api/catalog` typeahead; Inventory view; migrate `items` | Duplicate-detection quality; data migration from `items` | Typeahead suggests existing materials; new project reuses catalog; no duplicate isolated materials; inventory aggregates |
| **5 — Documents & reports consolidation** | Merge media→Documents; Documents tabs; rename docs→Knowledge, documentation→Project Reports; project-scoped filtering | Losing existing media links | One Documents module with tabs, project-filterable; Reports generates summaries; media route retired |
| **6 — Closeout rebuild** | Extend `computeSummary` (committed/variance/status/consumed/wasted/defects/docs/inspection); printable PDF | Numbers must reconcile with Budget tab | Closeout report fully computed; matches Budget/Resources; PDF export; acceptance closes project |
| **7 — Dashboard analytics** | Replace `/api/dashboard` with project queries; charts (burn, progress, usage); portfolio + health + procurement + shortages + closeout-ready | Query performance | Dashboard reads only project domain; every card backed by a real query; charts render |
| **8 — Hardening** | Constraints, migration verification, integration + permission tests, remove dead CRM code after confirmation | Deleting still-referenced code | `verify-schema` + `test:db` green; permission tests; no fake data; deprecated routes removed |

---

## Appendix — Evidence
- `/api/dashboard` table refs: `deals`×10, `prospects`×6, `staff`,`payments`,`followups`,`systems`,`operations`,`budgets`,`clients`, financial views — **no** `projects`/`project_budgets`/`work_items`/`blockers`/`resources`/`procurement_requests`.
- `/api/budgets`: `SELECT * FROM v_budget_utilization`; `INSERT INTO budgets`. `project_budgets` only under `/api/projects/[id]/*`.
- "Project Pipeline" children → `/app/pipeline`,`/app/prospects`,`/app/proposals`,`/app/followups`,`/app/clients`.
- Overlapping routes: `/app/items`(items), `/app/products`(products), `/app/assets`, `/app/resources`(standalone), `/app/media`(media).
- Project domain (built, real): `/api/projects/[id]/{budget,funding,resources,resources/[rid]/movements,procurement,procurement/[prid]/receipts,blockers,blockers/diagnose,risks,issues,defects,inspections,change-orders,closure}`.
