# CONSTY — Procurement → Resources Receiving Reality Audit

**Status:** Audit + plan. Implementation starts at Phase 1 immediately after.
**Date:** 2026-06-16
**Constraint:** raw SQL, no ORM. Additive, idempotent, backup-before-migrate, verify-after, `test:db`.
**Principle:** Procurement, Resources, Budget and Closeout must share ONE source of truth, and model real logistics (batches, partials, rejections), not procurement forms.

---

## 1. Current procurement-to-resources audit (grounded)

| Concern | Today | Gap |
|---|---|---|
| Procurement line items stored | `procurement_request_lines` ✅ | — |
| Requested quantity | `quantity` ✅ | — |
| Ordered quantity | ❌ | add `ordered_quantity` |
| Received quantity | ❌ | add `received_quantity` |
| Rejected quantity | ❌ | add `rejected_quantity` |
| Remaining computed | ❌ | add generated `remaining_quantity` |
| Line status | ❌ | add `status` (requested/ordered/partially_received/fully_received/rejected/cancelled) |
| Actual unit cost | ❌ | add `actual_unit_cost`, generated `actual_total` |
| Partial receiving possible | ❌ (request-level full receipt) | line-level receipts |
| Multiple receipts per request | header table allows rows, but **no line breakdown** | add `goods_receipt_lines` |
| One receipt → only some lines | ❌ | line-level receipts |
| Received lines create/update resources | ❌ (**receiving creates no resources**) | sync engine |
| Unreceived lines show as incoming resources | ❌ | expected/incoming resources |
| Request status from line-level receiving | ❌ (manual status) | rollup |
| Resources tab reads procurement-linked resources | ❌ (resources are manual only) | `source_type='procurement'`, `source_line_item_id` |

**Confirmed in code:** the receipts route records a header `goods_receipts` row, advances the request to `received`/`inspected`, then **settles every open commitment and posts category expenses** — i.e. a *full* conversion regardless of how much actually arrived. No resource records are touched.

## 2. Missing tables / columns

**New table — `goods_receipt_lines`:** `id, goods_receipt_id, procurement_line_item_id, quantity_received, quantity_rejected, actual_unit_cost, storage_location, inspection_status(pending/accepted/partially_accepted/rejected), rejection_reason`.

**`procurement_request_lines` add:** `ordered_quantity, received_quantity, rejected_quantity, remaining_quantity (generated = quantity − received − rejected), actual_unit_cost, actual_total (generated = received × COALESCE(actual_unit_cost, est_unit_cost)), status, work_item_id`.

**`goods_receipts` add:** `project_id, received_by, delivery_note_number, receipt_document_id`.

**`resources` add:** `source_type(manual/procurement), source_line_item_id → procurement_request_lines, incoming_quantity, rejected_quantity, status(expected/incoming/partially_available/available/consumed/returned/wasted/cancelled)`. (`catalog_item_id` already present.)

**`procurement_requests` status:** extend CHECK with `partially_received`, `fully_received`.

**Constraints:** line `CHECK (received_quantity + rejected_quantity <= quantity)` (over-receipt blocked unless `quantity`/`ordered` bumped via override); receipt-line quantities `>= 0`.

## 3. API refactor plan
- `POST /api/projects/[id]/procurement/[prid]/receipts` → **rebuilt line-level**: body `{ delivery_note_number?, supplier_id?, notes?, lines: [{ line_item_id, quantity_received, quantity_rejected, actual_unit_cost?, storage_location?, inspection_status?, rejection_reason? }] }`. Creates one `goods_receipts` + N `goods_receipt_lines`; updates each line's received/rejected; rolls up line + request status; **syncs resources**; **converts only the accepted received value** commitment→actual.
- `PATCH /api/projects/[id]/procurement/[prid]` → on **approve/submit**, create **expected** project resources per line; set lines `ordered`.
- `GET …/[prid]` → return per-line received/rejected/remaining/status + receipts with lines.
- Resources API → expose `incoming/rejected/status` and filter by status.

## 4. UI refactor plan
- **Receive Goods modal** lists every line: item · spec · requested/ordered · already received · remaining · **receive-now** · **reject-now** · actual unit cost · inspection · storage · reason. Allows receiving *some* lines and *partial* quantities. Validates `receive+reject ≤ remaining`.
- **Procurement detail**: per-line requested/received/remaining/rejected + line status badges; request status chip incl. partially/fully received.
- **Resources tab**: status column + filter (Expected · Incoming · Partial · Available · Consumed · Returned · Wasted); show Required / Incoming / Received / Available / Rejected.

## 5. Migration plan (raw SQL)
`0016_procurement_receiving.sql` (additive, idempotent): add line qty/cost/status cols + generated remaining/actual_total; add `goods_receipt_lines`; extend `goods_receipts`; add resource sync cols + status; extend request status CHECK; guard constraints. Backup → migrate → verify → `test:db`. DB near-empty ⇒ trivial backfill.

## 6. State transition rules
- **Line:** `requested → ordered →` (receipts) `→ partially_received → fully_received`; `rejected` when all outstanding rejected; `cancelled` manual. `fully_received` when `received_quantity ≥ quantity` (or `received + rejected = quantity`).
- **Request:** `submitted/approved → ordered →` `partially_received` (any line received, not all complete) `→ fully_received` (all lines fully_received or cancelled) `→ closed`; `cancelled`.
- **Resource:** `expected` (created on approval, incoming=requested) `→ incoming` (ordered) `→ partially_available` (some received) `→ available` (all received) `→ consumed/returned/wasted` via movements; `cancelled`.

## 7. Budget impact rules
- Approve → commitment per category (exists).
- **Receive accepted qty → convert only that value** to actual: `accepted_value = quantity_received × COALESCE(actual_unit_cost, est_unit_cost)`; reduce the line's category commitment by that value (partial settle) and post a category expense for it. Remaining stays committed.
- **Rejected qty → no actual spend** (default; policy flag `rejected_but_paid` future).
- Over-receipt blocked unless override raises `ordered`/`quantity`.

## 8. Resources-tab synchronization rules
- On approve: upsert a `resources` row per line (`source_type='procurement'`, `source_line_item_id`, `required_quantity=quantity`, `incoming_quantity=quantity`, `available=0`, `status='expected'`).
- On receipt line: `available += accepted`, `incoming = max(quantity − received − rejected, 0)`, `rejected += rejected`, `quantity_available += accepted`; status → partially_available/available.
- Movements (consume/return/waste) continue to adjust available/consumed/returned/wasted and status.
- Resources tab reads these; one row per procurement line + manual rows.

## 9. Edge cases
Receive some lines only · same line across batches · reject part · receive < ordered · receive > ordered (block/override) · actual ≠ estimated cost · supplier change at delivery · cancel after partial receipt (keep received, cancel remaining commitment) · consume before full receipt · returns after consumption · waste after receipt · goods without invoice · received-unpaid / paid-unreceived (status flags).

## 10. Implementation phases (this refactor)
1. **Data model** — `goods_receipt_lines`; line qty/cost/status; resource sync cols/status; request status; guards.
2. **Receiving logic** — line-level receive API; multiple receipts; per-line partial + reject; line + request status rollup; over-receipt block.
3. **Procurement → Resources sync** — expected resources on approval; receipt updates linked resources; tab shows incoming/partial.
4. **Budget sync** — partial accepted → actual; remaining stays committed; rejected excluded.
5. **UI** — line-level Receive Goods modal; per-line columns; Resources status + filters.
6. **Tests** — partial, batched, rejected, over-receipt block, status rollup, resource sync, commitment→actual partial, closeout impact.

**Plus:** `/activity` refactor — point the activity feed at project-domain events (projects, work_items, procurement, budget, resources) instead of inherited Jeton event types/labels.
