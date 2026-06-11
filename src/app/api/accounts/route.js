import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/accounts — accounts.view
export async function GET(request) {
  const perm = await requirePermission(request, 'accounts.view');
  if (perm instanceof NextResponse) return perm;
  try {
    // Use the view to get balances computed from ledger (alias account_id → id for frontend compat)
    const result = await query(`SELECT account_id AS id, * FROM v_account_balances ORDER BY balance DESC`);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Accounts] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

// POST /api/accounts — accounts.create
export async function POST(request) {
  const perm = await requirePermission(request, 'accounts.create');
  if (perm instanceof NextResponse) return perm;
  try {
    const body = await request.json();
    const { name, type, currency, description, institution, account_number, initial_balance } = body;
    if (!name || !type) return NextResponse.json({ success: false, error: 'name and type are required' }, { status: 400 });
    const VALID_TYPES = ['bank','cash','mobile_money','credit_card','investment','escrow','savings','internal','salary','other'];
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ success: false, error: `Invalid account type "${type}". Allowed: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }
    const result = await query(
      `INSERT INTO accounts (name, type, currency, description, institution, account_number)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, type, currency||'UGX', description||null, institution||null, account_number||null]
    );
    // If initial balance provided, create a ledger entry
    if (initial_balance && parseFloat(initial_balance) !== 0) {
      await query(
        `INSERT INTO ledger (account_id, amount, currency, source_type, description, category, entry_date, created_by)
         VALUES ($1,$2,$3,'initial_balance',$4,'initial_balance',CURRENT_DATE,$5)`,
        [result.rows[0].id, parseFloat(initial_balance), currency||'UGX',
         `Initial balance for ${name}`, perm.userId]
      );
    }
    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [perm.userId, 'CREATE', 'account', result.rows[0].id, JSON.stringify({ name, type })]);
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Accounts] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create account' }, { status: 500 });
  }
}
