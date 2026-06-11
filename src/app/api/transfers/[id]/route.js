import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'finance.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const result = await query(
      `SELECT t.*, fa.name as from_account_name, ta.name as to_account_name
       FROM transfers t JOIN accounts fa ON t.from_account_id = fa.id JOIN accounts ta ON t.to_account_id = ta.id
       WHERE t.id = $1`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Transfer not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch transfer' }, { status: 500 });
  }
}
