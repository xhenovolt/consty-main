import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/obligations
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'operations.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const deal_id = searchParams.get('deal_id');
    const client_id = searchParams.get('client_id');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');

    let sql = `
      SELECT co.*,
        c.name as client_name,
        d.title as deal_title,
        sys.name as system_name,
        st.name as assigned_to_name,
        u.full_name as created_by_name
      FROM client_obligations co
      LEFT JOIN clients c ON co.client_id = c.id
      LEFT JOIN deals d ON co.deal_id = d.id
      LEFT JOIN systems sys ON co.system_id = sys.id
      LEFT JOIN staff st ON co.assigned_to = st.id
      LEFT JOIN users u ON co.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (deal_id) { params.push(deal_id); sql += ` AND co.deal_id = $${params.length}`; }
    if (client_id) { params.push(client_id); sql += ` AND co.client_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND co.status = $${params.length}`; }
    if (priority) { params.push(priority); sql += ` AND co.priority = $${params.length}`; }

    sql += ` ORDER BY
      CASE co.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      co.due_date ASC NULLS LAST,
      co.created_at DESC
    `;

    const result = await query(sql, params);

    // Summary counts
    const summary = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'blocked') as blocked,
        COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('completed')) as overdue
      FROM client_obligations
    `);

    return NextResponse.json({
      success: true,
      data: result.rows,
      summary: summary.rows[0] || {},
    });
  } catch (error) {
    console.error('[Obligations] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch obligations' }, { status: 500 });
  }
}

// POST /api/obligations
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'operations.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { deal_id, client_id, system_id, title, description, priority, status, assigned_to, due_date, notes } = body;

    if (!title) return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });

    const result = await query(
      `INSERT INTO client_obligations (deal_id, client_id, system_id, title, description, priority, status, assigned_to, due_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [deal_id || null, client_id || null, system_id || null,
       title, description || null, priority || 'medium', status || 'pending',
       assigned_to || null, due_date || null, notes || null, auth.userId]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'obligation', result.rows[0].id, JSON.stringify({ title, deal_id, client_id })]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Obligations] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create obligation' }, { status: 500 });
  }
}

// POST /api/obligations?action=from_template — Create obligations from templates
// Body: { deal_id, client_id, system_id }
export async function PUT(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { deal_id, client_id, system_id } = body;

    if (!system_id) return NextResponse.json({ success: false, error: 'system_id is required' }, { status: 400 });

    // Fetch templates for this system
    const templates = await query(
      `SELECT * FROM obligation_templates WHERE system_id = $1 ORDER BY sort_order`,
      [system_id]
    );

    if (templates.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No templates found for this system' }, { status: 404 });
    }

    const created = [];
    for (const t of templates.rows) {
      const r = await query(
        `INSERT INTO client_obligations (deal_id, client_id, system_id, title, description, priority, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING *`,
        [deal_id || null, client_id || null, system_id, t.title, t.description, t.default_priority, auth.userId]
      );
      created.push(r.rows[0]);
    }

    return NextResponse.json({ success: true, data: created, count: created.length });
  } catch (error) {
    console.error('[Obligations] PUT (from_template) error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create obligations from templates' }, { status: 500 });
  }
}

// PATCH /api/obligations
export async function PATCH(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const allowed = ['title','description','priority','status','assigned_to','due_date','notes'];
    const updates = [];
    const values = [];

    allowed.forEach(f => {
      if (fields[f] !== undefined) { values.push(fields[f]); updates.push(`${f} = $${values.length}`); }
    });

    // Auto-set completed_at/completed_by
    if (fields.status === 'completed') {
      updates.push('completed_at = NOW()');
      values.push(auth.userId);
      updates.push(`completed_by = $${values.length}`);
    }

    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    updates.push('updated_at = NOW()');
    values.push(id);

    const result = await query(`UPDATE client_obligations SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Obligations] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update obligation' }, { status: 500 });
  }
}

// DELETE /api/obligations?id=xxx
export async function DELETE(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    await query(`DELETE FROM client_obligations WHERE id=$1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
  }
}
