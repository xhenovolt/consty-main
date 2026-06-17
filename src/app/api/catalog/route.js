import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

const CATEGORIES = ['labour', 'staff', 'subcontractor', 'equipment', 'vehicle', 'material', 'tool',
  'fuel', 'water', 'power', 'money', 'document', 'permit', 'reusable_asset', 'consumable'];

// GET /api/catalog?search=&category= — typeahead: catalog items + previously-used
// project materials not yet in the catalog (so nothing gets re-created blindly).
export async function GET(request) {
  const perm = await requirePermission(request, 'projects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const category = searchParams.get('category');

  const cat = [];
  let cSql = `SELECT id, name, category, type, unit_of_measure, specification, manufacturer,
                     default_unit_cost AS unit_cost, currency, attributes
              FROM resource_catalog WHERE is_active = true`;
  if (search)   { cat.push(`%${search}%`); cSql += ` AND name ILIKE $${cat.length}`; }
  if (category) { cat.push(category);      cSql += ` AND category = $${cat.length}`; }
  cSql += ` ORDER BY name LIMIT 50`;
  const catalog = (await query(cSql, cat)).rows.map(r => ({ ...r, source: 'catalog' }));

  // Distinct previously-used project resources not linked to a catalog item.
  const u = [];
  let uSql = `SELECT DISTINCT ON (lower(name)) name, category, unit_of_measure, manufacturer, unit_cost
              FROM resources WHERE catalog_item_id IS NULL`;
  if (search)   { u.push(`%${search}%`); uSql += ` AND name ILIKE $${u.length}`; }
  if (category) { u.push(category);      uSql += ` AND category = $${u.length}`; }
  uSql += ` ORDER BY lower(name) LIMIT 30`;
  const seen = new Set(catalog.map(c => c.name.toLowerCase()));
  const used = (await query(uSql, u)).rows
    .filter(r => !seen.has(r.name.toLowerCase()))
    .map(r => ({ id: null, ...r, source: 'used' }));

  return NextResponse.json({ success: true, data: [...catalog, ...used], catalog });
}

// POST /api/catalog — create a reusable catalog item
export async function POST(request) {
  const perm = await requirePermission(request, 'projects', 'edit');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;
  try {
    const b = await request.json();
    if (!b.name || !b.category) return NextResponse.json({ success: false, error: 'name and category are required' }, { status: 400 });
    if (!CATEGORIES.includes(b.category)) return NextResponse.json({ success: false, error: 'Invalid category' }, { status: 400 });
    const { rows } = await query(
      `INSERT INTO resource_catalog
         (name, category, type, unit_of_measure, specification, manufacturer, default_supplier_id, default_unit_cost, currency, attributes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7::uuid,COALESCE($8,0),COALESCE($9,'UGX'),COALESCE($10,'{}')::jsonb,$11::uuid)
       RETURNING *`,
      [b.name, b.category, b.type || null, b.unit_of_measure || null, b.specification || null, b.manufacturer || null,
       b.default_supplier_id || null, b.default_unit_cost ?? null, b.currency || null,
       b.attributes ? JSON.stringify(b.attributes) : null, auth.userId]
    );
    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Catalog] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create catalog item' }, { status: 500 });
  }
}
