import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/invoices — List invoices with filtering
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'invoices', 'view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const deal_id = searchParams.get('deal_id');
    const client_id = searchParams.get('client_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100);
    const offset = (page - 1) * limit;

    let sql = `SELECT * FROM invoices WHERE 1=1`;
    let countSql = `SELECT COUNT(*) FROM invoices WHERE 1=1`;
    const params = [];
    const countParams = [];

    if (deal_id) {
      params.push(deal_id);
      countParams.push(deal_id);
      sql += ` AND deal_id = $${params.length}`;
      countSql += ` AND deal_id = $${countParams.length}`;
    }
    if (client_id) {
      params.push(client_id);
      countParams.push(client_id);
      sql += ` AND client_id = $${params.length}`;
      countSql += ` AND client_id = $${countParams.length}`;
    }
    if (status) {
      params.push(status);
      countParams.push(status);
      sql += ` AND status = $${params.length}`;
      countSql += ` AND status = $${countParams.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      countParams.push(`%${search}%`);
      sql += ` AND (client_name ILIKE $${params.length} OR invoice_number ILIKE $${params.length} OR deal_title ILIKE $${params.length})`;
      countSql += ` AND (client_name ILIKE $${countParams.length} OR invoice_number ILIKE $${countParams.length} OR deal_title ILIKE $${countParams.length})`;
    }
    if (date_from) {
      params.push(date_from);
      countParams.push(date_from);
      sql += ` AND issued_date >= $${params.length}`;
      countSql += ` AND issued_date >= $${countParams.length}`;
    }
    if (date_to) {
      params.push(date_to);
      countParams.push(date_to);
      sql += ` AND issued_date <= $${params.length}`;
      countSql += ` AND issued_date <= $${countParams.length}`;
    }

    sql += ` ORDER BY created_at DESC`;
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const [dataResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams),
    ]);

    return NextResponse.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (error) {
    console.error('[Invoices] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch invoices' }, { status: 500 });
  }
}
