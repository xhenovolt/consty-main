import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

const VALID_CATEGORIES = ['hardware','clothing','infrastructure','transport','office_equipment','branding_material','software','other'];
const VALID_TYPES = ['development_tool','sales_tool','infrastructure','equipment','branding','transport','other'];
const VALID_FINANCIAL = ['asset','operational_asset','expense_item'];
const VALID_STATUSES = ['active','retired','lost','damaged','maintenance'];

// GET /api/items
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'operations.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const financial_class = searchParams.get('financial_class');
    const status = searchParams.get('status');
    const revenue_dependency = searchParams.get('revenue_dependency');
    const linked_system = searchParams.get('linked_system');
    const view = searchParams.get('view'); // 'assets' | 'tools' | 'infrastructure' | 'revenue_critical'

    let sql = `
      SELECT i.*,
        st.name as assigned_to_name,
        sys.name as system_name,
        u.name as created_by_name
      FROM items i
      LEFT JOIN staff st ON i.assigned_to = st.id
      LEFT JOIN systems sys ON i.linked_system = sys.id
      LEFT JOIN users u ON i.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    // View-based filters (classification views)
    if (view === 'assets') { params.push('asset'); sql += ` AND i.financial_class = $${params.length}`; }
    else if (view === 'tools') { sql += ` AND i.type IN ('development_tool','sales_tool')`; }
    else if (view === 'infrastructure') { params.push('infrastructure'); sql += ` AND i.category = $${params.length}`; }
    else if (view === 'revenue_critical') { sql += ` AND i.revenue_dependency = true`; }

    // Direct filters
    if (category) { params.push(category); sql += ` AND i.category = $${params.length}`; }
    if (type) { params.push(type); sql += ` AND i.type = $${params.length}`; }
    if (financial_class) { params.push(financial_class); sql += ` AND i.financial_class = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND i.status = $${params.length}`; }
    if (revenue_dependency === 'true') { sql += ` AND i.revenue_dependency = true`; }
    if (linked_system) { params.push(linked_system); sql += ` AND i.linked_system = $${params.length}`; }

    sql += ` ORDER BY i.created_at DESC`;

    const result = await query(sql, params);

    // Summary stats
    const stats = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE financial_class = 'asset') as assets_count,
        COUNT(*) FILTER (WHERE type IN ('development_tool','sales_tool')) as tools_count,
        COUNT(*) FILTER (WHERE category = 'infrastructure') as infra_count,
        COUNT(*) FILTER (WHERE revenue_dependency = true) as revenue_critical_count,
        COALESCE(SUM(purchase_cost), 0) as total_value,
        COALESCE(SUM(current_value), 0) as total_current_value,
        COALESCE(SUM(purchase_cost) FILTER (WHERE revenue_dependency = true), 0) as revenue_critical_value
      FROM items WHERE status = 'active'
    `);

    return NextResponse.json({
      success: true,
      data: result.rows,
      stats: stats.rows[0] || {},
    });
  } catch (error) {
    console.error('[Items] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch items' }, { status: 500 });
  }
}

// POST /api/items
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'operations.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const {
      name, description, category, type, financial_class,
      purchase_cost, current_value, currency, acquisition_date,
      assigned_to, linked_system, revenue_dependency,
      status, condition, provider, renewal_date,
      serial_number, location, is_historical,
      account_deducted_from, notes, usage_notes,
    } = body;

    if (!name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ success: false, error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
    }
    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ success: false, error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }

    // Duplicate check: same name, category, and assigned_to
    const dup = await query(
      `SELECT id, name, category FROM items WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND category = $2 AND status = 'active' LIMIT 1`,
      [name, category]
    );
    if (dup.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'duplicate_detected',
        existing: dup.rows[0],
        message: `An item with similar characteristics already exists: "${dup.rows[0].name}". Do you want to update the existing item instead?`,
      }, { status: 409 });
    }

    const effectiveCost = purchase_cost ? parseFloat(purchase_cost) : null;

    const result = await query(
      `INSERT INTO items (
        name, description, category, type, financial_class,
        purchase_cost, current_value, currency, acquisition_date,
        assigned_to, linked_system, revenue_dependency,
        status, condition, provider, renewal_date,
        serial_number, location, is_historical,
        account_deducted_from, notes, usage_notes, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING *`,
      [
        name, description || null, category, type,
        financial_class || 'asset',
        effectiveCost,
        current_value ? parseFloat(current_value) : effectiveCost,
        currency || 'UGX',
        acquisition_date || null,
        assigned_to || null,
        linked_system || null,
        revenue_dependency || false,
        status || 'active',
        condition || 'good',
        provider || null,
        renewal_date || null,
        serial_number || null,
        location || null,
        is_historical || false,
        account_deducted_from || null,
        notes || null,
        usage_notes || null,
        auth.userId,
      ]
    );

    const item = result.rows[0];

    // Fire-and-forget: secondary logging (don't block the response)
    const bgWork = async () => {
      try {
        if (effectiveCost && account_deducted_from) {
          const ledgerResult = await query(
            `INSERT INTO ledger (account_id, amount, currency, source_type, source_id, description, category, entry_date, created_by)
             VALUES ($1,$2,$3,'expense',$4,$5,'item_acquisition',COALESCE($6, CURRENT_DATE),$7) RETURNING id`,
            [account_deducted_from, -Math.abs(effectiveCost), currency || 'UGX',
             item.id, `Item acquisition: ${name}`, acquisition_date, auth.userId]
          );
          await query(`UPDATE items SET ledger_entry_id=$1 WHERE id=$2`, [ledgerResult.rows[0].id, item.id]);
        }
        await query(
          `INSERT INTO item_activity_log (item_id, user_id, action, details) VALUES ($1,$2,'created',$3)`,
          [item.id, auth.userId, JSON.stringify({ name, category, type })]
        );
        await query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
          [auth.userId, 'CREATE', 'item', item.id, JSON.stringify({ name, category, type, financial_class })]
        );
      } catch (bgErr) {
        console.error('[Items] Background logging error:', bgErr.message);
      }
    };
    bgWork();

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    console.error('[Items] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create item: ' + error.message }, { status: 500 });
  }
}

// PATCH /api/items
export async function PATCH(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { id, force_duplicate, ...fields } = body;
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const allowed = [
      'name','description','category','type','financial_class',
      'purchase_cost','current_value','currency','acquisition_date',
      'assigned_to','linked_system','revenue_dependency',
      'status','condition','provider','renewal_date',
      'serial_number','location','is_historical','notes','usage_notes',
    ];
    const updates = [];
    const values = [];
    const changes = {};

    allowed.forEach(f => {
      if (fields[f] !== undefined) {
        values.push(fields[f]);
        updates.push(`${f} = $${values.length}`);
        changes[f] = fields[f];
      }
    });

    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    updates.push('updated_at = NOW()');
    values.push(id);

    const result = await query(`UPDATE items SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });

    // Fire-and-forget: activity log
    let action = 'edited';
    if (changes.status) action = 'status_changed';
    if (changes.assigned_to) action = 'assigned';
    query(
      `INSERT INTO item_activity_log (item_id, user_id, action, details) VALUES ($1,$2,$3,$4)`,
      [id, auth.userId, action, JSON.stringify(changes)]
    ).catch(e => console.error('[Items] Activity log error:', e.message));

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Items] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update item' }, { status: 500 });
  }
}

// DELETE /api/items?id=xxx
export async function DELETE(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    const result = await query(`DELETE FROM items WHERE id=$1 RETURNING id, name`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    // Fire-and-forget: audit log
    query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'DELETE', 'item', id, JSON.stringify({ name: result.rows[0].name })]
    ).catch(e => console.error('[Items] Audit log error:', e.message));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Items] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete item' }, { status: 500 });
  }
}
