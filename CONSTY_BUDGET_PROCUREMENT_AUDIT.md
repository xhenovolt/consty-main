# CONSTY — Budget & Procurement Backbone Audit

**Status:** Audit + design only — no implementation in this document.
**Date:** 2026-06-16
**Constraint:** No ORM. Raw SQL with migration discipline, DB constraints, verification, tests.
**Scope:** Budget and Procurement only. These are the financial/resource backbone; nothing else (dashboards, analytics, resources, closeout polish) proceeds until these are correct.

> **In-progress note:** there is **uncommitted** budget-bridge work in the tree (a project-expense API `/api/projects/[id]/expenses`, a finance rollup `/api/finance/project-budgets`, and a dashboard rebuild). It partially addresses "Actual spent" (adds a way to log project expenses) but is **superseded/extended** by the category-based rebuild below. It is paused, not committed.

---

## 1. Current Budget Architecture (as built)

**Tables**
- `project_budgets` — flat totals per project: `allocated_amount, committed_amount, actual_amount, forecast_amount, currency, margin_band, status, is_frozen`. One row per project (UNIQUE).
- `funding_sources` — per project: `source_type` (company_wallet/client_deposit/external_funder/loan/grant/donor/retained_earnings/manual_external), `amount`, `status`.
- `budget_lines` — **per project + category**: `category, allocated, committed, actual, forecast, work_item_id`. **← exists in schema, referenced by ZERO routes/UI. This is the category mechanism, never wired.**
- `commitments` — `project_id, work_item_id, procurement_request_id, amount, status(open/settled/cancelled)`.
- `expenses` — company ledger table; gained `project_id, work_item_id, commitment_id`. `account_id`, `amount`, `category`, `description` are **NOT NULL**.

**API** (`/api/projects/[id]/budget` GET/PUT)
- GET `recompute()`: `committed = Σ commitments(open)`, `actual = Σ expenses(project_id)`, `forecast = max(stored forecast, actual+committed)`; then `fn_budget_status`.
- PUT: upserts `allocated_amount`, `forecast_amount`, freeze.

**UI** (Budget tab): cards Allocated · Committed · Actual · Forecast · Remaining · Variance · Funding pledged · Status; inputs for **Allocated** and **Forecast**; funding-source manager.

### Manual vs derived vs fake — the honest table
| Field | Source today | Verdict |
|---|---|---|
| **Allocated** | **Manual** (PUT) | OK to be manual — but should be **per category**, summed to project total (not one lump) |
| **Forecast** | **Manual** (PUT), default `max(stored, actual+committed)` | **FAKE / wrong** — a user typing a forecast defeats the purpose. Must be **derived** |
| **Committed** | Derived: `Σ commitments(open)` | Real, but only moves when procurement is **approved**; invisible because procurement lines aren't budget-linked |
| **Actual spent** | Derived: `Σ expenses(project_id)` | **Was effectively fake**: until the (uncommitted) expense route, there was **no way to create a project expense** → always 0 |
| **Remaining** | Derived: `allocated − actual` | OK |
| **Variance** | Derived: `allocated − forecast` | Tainted by fake forecast |
| **Funding pledged** | Derived: `Σ funding_sources.amount` | OK |
| **Status** | Derived: `fn_budget_status` | OK (frozen/overrun/deficit/tight/surplus/balanced) |

**Fake/placeholder calculations identified**
1. **Forecast is hand-typed** — should be computed (`actual + committed + estimate-to-complete`).
2. **Actual had no operational feeder** — no project-expense entry path in the shipped UI ⇒ 0 ⇒ fake Remaining/Variance.
3. **No category dimension** — `budget_lines` unused ⇒ "Allocated" is a single number that cannot answer *materials vs labour vs transport*.
4. **`project_budgets` is a hand-maintained cache**, not a derivation of line items.

---

## 2. Current Procurement Architecture (as built)

**Tables**
- `procurement_requests` — `project_id, work_item_id, title, description, status (requested→approved→ordered→received→inspected→stored→allocated→closed/rejected), supplier_id, total_est_cost, currency, needed_by, requested_by, approved_by`.
- `procurement_request_lines` — `request_id, resource_id, description, quantity, unit, est_unit_cost`. **No structured item identity** (uses free-text `description`), **no specification, no per-line supplier, no budget category, no computed line total**. `resource_id` exists but there is **no resource catalog** to point at, so it's effectively null.
- `goods_receipts` — `received_qty, rejected_qty, inspection_status, ...`.

**Integration today**
- On **approve** → one `commitment` for `total_est_cost` is created (feeds `project_budgets.committed_amount`). ✅ This bridge exists.
- On **goods receipt** → records receipt + advances status, but **does not** move committed→actual and **does not** post to inventory/resources.

**Problems**
1. Line items lack **item identity** (name + catalog/material reference + specification). "Cement" vs "Cement | Tororo PPC 32.5R" is impossible.
2. No **per-line supplier**, **budget category**, or **est_total** (must derive `qty × unit_cost`).
3. Commitment is a single lump per request — **not attributed to budget categories**, so approving procurement can't fill `budget_lines.committed` per category.
4. **Goods received ↛ Actual spent**: the `Committed → Actual` transition the brief requires is not implemented.

---

## 3. Fake calculations (summary)
- **Budget Forecast** = manual input (should be derived).
- **Actual spent** = 0 in practice (no expense feeder in shipped UI).
- **Committed** = real but un-categorised and only via approved procurement.
- **Category allocation** = absent (`budget_lines` dead).
- **Procurement line total** = not computed; **item identity** = absent.

## 4. Disconnected tables / routes
| Object | State | Fix |
|---|---|---|
| `budget_lines` | **schema-only, zero references** | Make it the **core** of the budget model |
| `procurement_request_lines.resource_id` | points at non-existent catalog | Add `catalog_item_id` + catalog (later) or keep nullable; add structured fields |
| `commitments` → categories | lump per request, no category | Add `budget_line_id`/`budget_category` |
| `expenses` → categories | `project_id` only (uncommitted) | Add `budget_line_id`; roll actual into category |
| `project_budgets` totals | hand-maintained | Derive from `budget_lines` via recompute/trigger |
| goods receipt → actual | not implemented | Receipt converts committed→actual |

---

## 5. Revised Database Model (additive, raw SQL)

**Budget = category lines; project totals derived.**
```
budget_categories (lookup / CHECK):
  materials, labour, transport, equipment, permits, subcontractors, contingency, other

budget_lines  (already exists — becomes the source of truth)
  project_id, category, work_item_id NULL,
  allocated   numeric,         -- entered per category
  committed   numeric,         -- Σ open commitments in this category (derived)
  actual      numeric,         -- Σ expenses in this category (derived)
  forecast    numeric,         -- derived: actual + committed + ETC
  UNIQUE (project_id, category)   -- (+ optional work_item_id dimension later)

project_budgets  (becomes a rollup cache, recomputed)
  allocated = Σ budget_lines.allocated
  committed = Σ budget_lines.committed
  actual    = Σ budget_lines.actual
  forecast  = Σ budget_lines.forecast
  available = allocated − committed      -- NEW derived
  remaining = allocated − actual
  variance  = allocated − forecast
  status    = fn_budget_status(...)
```

**Procurement line items get identity + category.**
```
ALTER procurement_request_lines ADD:
  item_name          text NOT NULL,          -- "Cement"
  catalog_item_id    uuid NULL,              -- future resource catalog ref
  specification      text,                   -- "Tororo PPC 32.5R"
  supplier_id        uuid REFERENCES suppliers NULL,
  budget_category    text REFERENCES/CHECK budget categories,
  est_total          numeric GENERATED ALWAYS AS (quantity * est_unit_cost) STORED
  -- keep: quantity, unit, est_unit_cost, notes
ALTER procurement_requests ADD:
  reason text, budget_category text (default for lines)

ALTER commitments ADD:
  budget_category text,  budget_line_id uuid REFERENCES budget_lines NULL
ALTER expenses ADD (verify existing):
  budget_line_id uuid REFERENCES budget_lines NULL,  category already present
```

**Derivation functions (replace manual forecast):**
```
fn_recompute_budget(project_id):
  -- per category line:
  budget_lines.committed = Σ commitments(open) where budget_line matches
  budget_lines.actual    = Σ expenses where budget_line matches
  budget_lines.forecast  = actual + committed + max(allocated − actual − committed, 0)
  -- project rollup:
  project_budgets.{allocated,committed,actual,forecast} = Σ budget_lines.*
  fn_budget_status(project_id)
```
Called after any commitment/expense/allocation change (service-invoked, like the existing rollup pattern).

---

## 6. Revised UI Design

**Budget tab → category-driven.**
- A **category table**: rows = Materials / Labour / Transport / Equipment / Permits / Subcontractors / Contingency / + custom. Columns: **Allocated (editable)** · Committed (derived) · Actual (derived) · Forecast (derived) · Variance (derived).
- **Footer = project totals** (sum of lines). Cards above show Allocated · **Available (allocated−committed)** · Actual · Forecast · Remaining · Variance · Funding pledged · Status.
- **Remove the manual Forecast input.** Keep Allocated entry (per category), freeze toggle, funding-source manager, and the project-expense list.
- "Add category" + inline allocated editing per row.

**Procurement modal → detailed multi-line.**
- Header: Title · Reason · Needed by · Work item · default Budget category.
- Line rows (add/remove): **Item name** · catalog typeahead (optional) · **Specification** · Quantity · Unit · Unit cost · **Est total (auto)** · Supplier · Budget category · Notes.
- Live request total = Σ est_total. Example rows:
  ```
  Cement | Tororo PPC 32.5R | 200 | Bags   | 42,000 | = 8,400,000 | materials
  Rebar  | Y12 Steel        |  80 | Pieces | 35,000 | = 2,800,000 | materials
  Nails  | 4 Inch           |  20 | Kg     |  8,000 | =   160,000 | materials
  ```

---

## 7. Revised API Contract

**Budget**
- `GET  /api/projects/[id]/budget` → `{ totals, categories: budget_lines[], funding_sources[], expenses[] }`
- `PUT  /api/projects/[id]/budget` → set freeze / currency (no manual forecast)
- `POST /api/projects/[id]/budget/lines` → create/allocate a category `{ category, allocated, work_item_id? }`
- `PATCH/DELETE /api/projects/[id]/budget/lines/[lineId]` → edit allocated / remove
- `POST /api/projects/[id]/expenses` (exists, uncommitted) → add `budget_line_id`; recompute

**Procurement**
- `GET/POST /api/projects/[id]/procurement` → request + structured lines (item_name, specification, supplier, budget_category, est_total)
- `GET/PATCH /api/projects/[id]/procurement/[prid]` → status flow; **approve** creates **commitments per budget_category** → `fn_recompute_budget`
- `POST /api/projects/[id]/procurement/[prid]/receipts` → on receipt, **settle committed → actual** (create category expense, reduce commitment) → recompute

**Integration invariants**
```
Available = Allocated − Committed
Approve procurement  ⇒ Committed += Σ approved line est_total (by category)
Goods received       ⇒ Committed −= received value ; Actual += received value
Closeout             ⇒ reads Allocated/Committed/Actual/Variance from budget_lines rollup
```

---

## 8. Migration Plan (additive, ordered, idempotent)
1. `00XX_budget_categories.sql` — `budget_lines` UNIQUE(project_id, category); CHECK on category; (table already exists, add constraints/index).
2. `00XX_procurement_line_identity.sql` — `ALTER procurement_request_lines ADD item_name/catalog_item_id/specification/supplier_id/budget_category/est_total(generated)`; backfill `item_name = description`.
3. `00XX_commitment_expense_category.sql` — `ALTER commitments ADD budget_category, budget_line_id`; `ALTER expenses ADD budget_line_id` (if absent).
4. `00XX_budget_functions.sql` — `fn_recompute_budget(uuid)`; update `fn_budget_status` to read rollup.
- Each: `pg_dump` backup first, `verify-schema.mjs` after, `test:db` coverage. No drops. DB is near-empty ⇒ low data-migration risk.

---

## 9. Implementation Phases (this work only)

| Phase | Scope | Definition of Done |
|---|---|---|
| **B1 — Budget categories** | Wire `budget_lines`; category CRUD; project totals derived from lines; **forecast becomes derived**; Budget tab category table | Allocate per category; project totals = Σ lines; no manual forecast; tests |
| **B2 — Procurement line identity** | `item_name/specification/supplier/budget_category/est_total`; detailed multi-line modal | Request like the Cement/Rebar/Nails example; per-line totals + request total; tests |
| **B3 — Integration** | Approve → commitments **per category** into `budget_lines.committed`; receipt → committed→actual; `Available = Allocated − Committed` | Approving fills category committed; receiving moves committed→actual; invariants hold; tests |
| **B4 — Closeout linkage** | Closeout reads category rollup (allocated/committed/actual/variance, consumed/wasted) | Closeout numbers reconcile with Budget tab to the cent |
| **B5 — Hardening** | Constraints, `fn_recompute_budget` correctness, integration + permission tests; retire manual forecast paths | `verify-schema` + `test:db` green; no fake calc remains |

**Definition of done for the backbone:** every Budget figure is either an explicit per-category allocation or a derivation of commitments/expenses; every Procurement line has real item identity and rolls, on approval and receipt, into the correct budget category — and Closeout reads those same numbers.
