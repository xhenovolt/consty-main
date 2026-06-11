import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';

const VALID_CATEGORIES = [
  'transport', 'prospecting', 'internet_data', 'marketing',
  'equipment', 'office', 'utilities', 'communication', 'salary', 'other',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUUID(v) { return typeof v === 'string' && UUID_RE.test(v); }

// GET /api/operations — with stats and summary
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'operations.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const expense_type = searchParams.get('expense_type');
    const has_expense = searchParams.get('has_expense'); // 'true' or 'false'
    const from_date = searchParams.get('from_date');
    const to_date = searchParams.get('to_date');
    const limit = parseInt(searchParams.get('limit') || '100');

    let sql = `
      SELECT o.*,
        a.name as account_name,
        u.name as created_by_name,
        s.name as system_name,
        d.title as deal_title
      FROM operations o
      LEFT JOIN accounts a ON o.account_id = a.id
      LEFT JOIN users u ON o.created_by = u.id
      LEFT JOIN systems s ON o.related_system_id = s.id
      LEFT JOIN deals d ON o.related_deal_id = d.id
      WHERE 1=1
    `;
    const params = [];
    if (category) { params.push(category); sql += ` AND o.category = $${params.length}`; }
    if (expense_type) { params.push(expense_type); sql += ` AND o.expense_type = $${params.length}`; }
    if (has_expense === 'true') sql += ` AND o.amount IS NOT NULL AND o.amount > 0`;
    if (has_expense === 'false') sql += ` AND (o.amount IS NULL OR o.amount = 0)`;
    if (from_date) { params.push(from_date); sql += ` AND COALESCE(o.operation_date, o.created_at::date) >= $${params.length}`; }
    if (to_date) { params.push(to_date); sql += ` AND COALESCE(o.operation_date, o.created_at::date) <= $${params.length}`; }
    params.push(limit);
    sql += ` ORDER BY COALESCE(o.operation_date, o.created_at::date) DESC, o.created_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);

    // Summary stats
    const statsResult = await query(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_spent,
        COUNT(CASE WHEN amount IS NOT NULL AND amount > 0 THEN 1 END) as with_expense,
        COUNT(CASE WHEN amount IS NULL OR amount = 0 THEN 1 END) as without_expense,
        COUNT(CASE WHEN operation_date >= CURRENT_DATE THEN 1 END) as today_count,
        COALESCE(SUM(CASE WHEN operation_date >= date_trunc('month', CURRENT_DATE) AND amount > 0 THEN amount ELSE 0 END), 0) as month_spent,
        COUNT(CASE WHEN operation_date >= date_trunc('month', CURRENT_DATE) THEN 1 END) as month_count
      FROM operations
    `);

    return NextResponse.json({
      success: true,
      data: result.rows,
      stats: statsResult.rows[0] || {},
    });
  } catch (error) {
    console.error('[Operations] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch operations' }, { status: 500 });
  }
}

// POST /api/operations — Create with optional ledger entry
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'operations.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const {
      title, description, category, expense_type, amount, currency,
      account_id, operation_date, vendor, receipt_url, notes,
      operation_type, related_system_id, related_deal_id,
    } = body;

    const effectiveTitle = title || description || operation_type;
    const effectiveCategory = category || (VALID_CATEGORIES.includes(operation_type) ? operation_type : 'other');
    // description must never be NULL — use title as fallback, then a safe default
    const effectiveDescription = description?.trim() || effectiveTitle || 'No description provided';

    if (!effectiveTitle) {
      return NextResponse.json({ success: false, error: 'title or description is required' }, { status: 400 });
    }

    // Validate UUIDs
    if (account_id && !isUUID(account_id)) {
      return NextResponse.json({ success: false, error: 'Invalid account_id format (must be UUID)' }, { status: 400 });
    }
    if (related_system_id && !isUUID(related_system_id)) {
      return NextResponse.json({ success: false, error: 'Invalid related_system_id format' }, { status: 400 });
    }
    if (related_deal_id && !isUUID(related_deal_id)) {
      return NextResponse.json({ success: false, error: 'Invalid related_deal_id format' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO operations (
        title, description, category, expense_type, amount, currency,
        account_id, operation_date, vendor, receipt_url, notes,
        related_system_id, related_deal_id, operation_type, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        effectiveTitle, effectiveDescription, effectiveCategory,
        expense_type || 'operational',
        amount ? parseFloat(amount) : null,
        currency || 'UGX',
        account_id || null,
        operation_date || null, vendor || null,
        receipt_url || null, notes || null,
        related_system_id || null, related_deal_id || null,
        operation_type || effectiveCategory, auth.userId,
      ]
    );

    // Auto-create ledger entry if amount + account provided
    if (amount && account_id && isUUID(account_id)) {
      try {
        const ledgerResult = await query(
          `INSERT INTO ledger (account_id, amount, currency, source_type, source_id, description, category, entry_date, created_by)
           VALUES ($1,$2,$3,'expense',$4,$5,'operations',COALESCE($6,CURRENT_DATE),$7) RETURNING id`,
          [account_id, -Math.abs(parseFloat(amount)), currency || 'UGX',
           result.rows[0].id, effectiveTitle, operation_date, auth.userId]
        );
        await query(
          `UPDATE operations SET ledger_entry_id=$1 WHERE id=$2`,
          [ledgerResult.rows[0].id, result.rows[0].id]
        );
        result.rows[0].ledger_entry_id = ledgerResult.rows[0].id;
      } catch (ledgerErr) {
        console.error('[Operations] Ledger entry failed:', ledgerErr.message);
      }
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'operation', result.rows[0].id,
       JSON.stringify({ title: effectiveTitle, category: effectiveCategory, amount })]
    );

    dispatch('operation_created', { entityType: 'operation', entityId: result.rows[0].id, description: `Operation: ${effectiveTitle}`, metadata: { title: effectiveTitle, category: effectiveCategory, amount }, actorId: auth.userId }).catch(() => {});

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Operations] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create operation: ' + error.message }, { status: 500 });
  }
}

// PATCH /api/operations — Edit operation, optionally link/update expense
export async function PATCH(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { id } = body;
    if (!id || !isUUID(id)) {
      return NextResponse.json({ success: false, error: 'Valid operation id is required' }, { status: 400 });
    }

    // Validate UUID fields
    if (body.account_id && !isUUID(body.account_id)) {
      return NextResponse.json({ success: false, error: 'Invalid account_id format' }, { status: 400 });
    }
    if (body.related_system_id && !isUUID(body.related_system_id)) {
      return NextResponse.json({ success: false, error: 'Invalid related_system_id format' }, { status: 400 });
    }
    if (body.related_deal_id && !isUUID(body.related_deal_id)) {
      return NextResponse.json({ success: false, error: 'Invalid related_deal_id format' }, { status: 400 });
    }

    // Get current operation
    const current = await query(`SELECT * FROM operations WHERE id = $1`, [id]);
    if (current.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Operation not found' }, { status: 404 });
    }
    const op = current.rows[0];

    // Build dynamic update
    const updates = [];
    const params = [];
    const fields = ['title', 'description', 'category', 'expense_type', 'amount', 'currency',
      'account_id', 'operation_date', 'vendor', 'receipt_url', 'notes',
      'related_system_id', 'related_deal_id', 'operation_type'];

    for (const field of fields) {
      if (body[field] !== undefined) {
        params.push(field === 'amount' && body[field] ? parseFloat(body[field]) : (body[field] || null));
        updates.push(`${field} = $${params.length}`);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);
    const result = await query(
      `UPDATE operations SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    const updated = result.rows[0];

    // If expense newly linked (amount + account added where there wasn't one before)
    const newAmount = body.amount !== undefined ? parseFloat(body.amount) : parseFloat(op.amount || 0);
    const newAccountId = body.account_id !== undefined ? body.account_id : op.account_id;

    if (newAmount > 0 && newAccountId && isUUID(newAccountId) && !op.ledger_entry_id) {
      try {
        const ledgerResult = await query(
          `INSERT INTO ledger (account_id, amount, currency, source_type, source_id, description, category, entry_date, created_by)
           VALUES ($1,$2,$3,'expense',$4,$5,'operations',COALESCE($6,CURRENT_DATE),$7) RETURNING id`,
          [newAccountId, -Math.abs(newAmount), updated.currency || 'UGX',
           id, updated.title, updated.operation_date, auth.userId]
        );
        await query(`UPDATE operations SET ledger_entry_id=$1 WHERE id=$2`, [ledgerResult.rows[0].id, id]);
        updated.ledger_entry_id = ledgerResult.rows[0].id;
      } catch (ledgerErr) {
        console.error('[Operations] Ledger link failed:', ledgerErr.message);
      }
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'UPDATE', 'operation', id, JSON.stringify({ fields_updated: Object.keys(body).filter(k => k !== 'id') })]
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Operations] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update operation: ' + error.message }, { status: 500 });
  }
}

// DELETE /api/operations?id=xxx — Remove operation and reverse ledger
export async function DELETE(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id || !isUUID(id)) {
      return NextResponse.json({ success: false, error: 'Valid id required' }, { status: 400 });
    }

    // Get operation to check for ledger entry
    const op = await query(`SELECT * FROM operations WHERE id = $1`, [id]);
    if (op.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Operation not found' }, { status: 404 });
    }

    // Reverse ledger entry if exists
    if (op.rows[0].ledger_entry_id) {
      try {
        const ledger = await query(`SELECT * FROM ledger WHERE id = $1`, [op.rows[0].ledger_entry_id]);
        if (ledger.rows.length > 0) {
          const entry = ledger.rows[0];
          await query(
            `INSERT INTO ledger (account_id, amount, currency, source_type, source_id, description, category, entry_date, created_by)
             VALUES ($1,$2,$3,'reversal',$4,$5,'operations',CURRENT_DATE,$6)`,
            [entry.account_id, Math.abs(parseFloat(entry.amount)), entry.currency,
             id, `Reversal: ${op.rows[0].title}`, auth.userId]
          );
        }
      } catch (revErr) {
        console.error('[Operations] Ledger reversal failed:', revErr.message);
      }
    }

    await query(`DELETE FROM operations WHERE id = $1`, [id]);

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'DELETE', 'operation', id, JSON.stringify({ title: op.rows[0].title })]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Operations] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete operation' }, { status: 500 });
  }
}
