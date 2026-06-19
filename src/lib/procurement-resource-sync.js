/**
 * Procurement → Resources synchronisation (one source of truth).
 *
 * Ensures every procurement line is reflected as a project resource, GROUPED
 * with any existing resource of the same catalog item or name+category (so a
 * manually-entered "Cement" and a procured "Cement" become ONE row — no double
 * entry). Works whether or not the request was formally approved.
 *
 * Quantity model on the resource row:
 *   - quantity_available : running stock (manual + Σ received), adjusted by
 *     receipt deltas and movements (consume/return/waste). NOT overwritten here.
 *   - incoming_quantity  : line.remaining (requested − received − rejected).
 *   - rejected_quantity  : line cumulative rejected.
 *   - status             : derived from available + incoming.
 */
import { query } from '@/lib/db.js';

// Procurement budget category → resource taxonomy category.
const CAT_MAP = {
  materials: 'material', equipment: 'equipment', transport: 'vehicle', fuel: 'fuel',
  labour: 'labour', subcontractors: 'subcontractor', permits: 'permit',
  contingency: 'material', other: 'material',
};
export function resourceCategoryFor(budgetCategory) {
  return CAT_MAP[budgetCategory] || 'material';
}

export function resourceStatusFor(required, available, incoming) {
  if (available > 0 && incoming > 0) return 'partially_available';
  if (available > 0) return 'available';
  if (incoming > 0) return 'incoming';
  return 'expected';
}

/**
 * Find an existing resource to group with (by source line → catalog → name+category),
 * link it to this line, or create a new one. Returns the resource id.
 * Does not touch quantity_available (managed by receipt deltas/movements).
 */
export async function findOrLinkResource(projectId, line, userId) {
  const cat = resourceCategoryFor(line.budget_category);
  const reqQty = Number(line.quantity) || 0;

  let r = (await query(`SELECT id FROM resources WHERE source_line_item_id = $1`, [line.id])).rows[0];
  if (!r && line.catalog_item_id) {
    r = (await query(
      `SELECT id FROM resources WHERE project_id = $1 AND catalog_item_id = $2 ORDER BY created_at LIMIT 1`,
      [projectId, line.catalog_item_id])).rows[0];
  }
  if (!r) {
    r = (await query(
      `SELECT id FROM resources WHERE project_id = $1 AND lower(name) = lower($2) AND category = $3
       ORDER BY (source_type = 'manual') DESC, created_at LIMIT 1`,
      [projectId, line.item_name, cat])).rows[0];
  }

  if (r) {
    await query(
      `UPDATE resources SET
         source_line_item_id = $1,
         catalog_item_id = COALESCE(catalog_item_id, $2),
         quantity_required = GREATEST(quantity_required, $3),
         unit_of_measure = COALESCE(NULLIF(unit_of_measure,''), $4),
         updated_at = now()
       WHERE id = $5`,
      [line.id, line.catalog_item_id || null, reqQty, line.unit || null, r.id]);
    return r.id;
  }

  const ins = await query(
    `INSERT INTO resources
       (project_id, name, category, unit_of_measure, quantity_required, unit_cost, currency,
        catalog_item_id, source_type, source_line_item_id, status, created_by)
     VALUES ($1::uuid,$2,$3,$4,$5,$6,'UGX',$7::uuid,'procurement',$8::uuid,'expected',$9::uuid)
     RETURNING id`,
    [projectId, line.item_name, cat, line.unit || null, reqQty, Number(line.est_unit_cost) || 0,
     line.catalog_item_id || null, line.id, userId || null]);
  return ins.rows[0].id;
}

/**
 * Refresh the derived fields (incoming, rejected, status) of a resource from a
 * procurement line's current received/rejected. `line` should carry the
 * up-to-date received_quantity/rejected_quantity.
 */
export async function refreshResourceFromLine(resourceId, line) {
  const required = Number(line.quantity) || 0;
  const remaining = Math.max(required - Number(line.received_quantity || 0) - Number(line.rejected_quantity || 0), 0);
  const avail = Number((await query(`SELECT quantity_available FROM resources WHERE id = $1`, [resourceId])).rows[0]?.quantity_available) || 0;
  await query(
    `UPDATE resources SET incoming_quantity = $1, rejected_quantity = $2, status = $3, updated_at = now() WHERE id = $4`,
    [remaining, Number(line.rejected_quantity || 0), resourceStatusFor(required, avail, remaining), resourceId]);
}
