import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/employees
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'employees', 'view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const department_id = searchParams.get('department_id');
    const status = searchParams.get('status');

    let sql = `SELECT e.*, d.department_name, r.name as role_name,
               m.full_name as manager_name
               FROM employees e
               LEFT JOIN departments d ON e.department_id = d.id
               LEFT JOIN roles r ON e.role_id = r.id
               LEFT JOIN employees m ON e.manager_id = m.id
               WHERE 1=1`;
    const params = [];
    if (department_id) { params.push(department_id); sql += ` AND e.department_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND e.employment_status = $${params.length}`; }
    sql += ` ORDER BY e.full_name`;

    const result = await query(sql, params);

    // Calculate active employee count and total salary
    const stats = await query(`
      SELECT COUNT(*) as total_active, COALESCE(SUM(salary), 0) as total_salary
      FROM employees WHERE employment_status = 'active'
    `);

    return NextResponse.json({ success: true, data: result.rows, stats: stats.rows[0] });
  } catch (error) {
    console.error('[Employees] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch employees' }, { status: 500 });
  }
}

// POST /api/employees
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'staff.create');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { full_name, email, phone, role_id, department_id, employment_status, employment_type, salary, salary_currency, hired_date, manager_id, user_account_id, notes } = body;
    if (!full_name) return NextResponse.json({ success: false, error: 'full_name required' }, { status: 400 });

    const result = await query(
      `INSERT INTO employees (full_name, email, phone, role_id, department_id, employment_status, employment_type, salary, salary_currency, hired_date, manager_id, user_account_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [full_name, email || null, phone || null, role_id || null, department_id || null,
       employment_status || 'active', employment_type || 'full_time',
       salary || null, salary_currency || 'UGX', hired_date || null, manager_id || null,
       user_account_id || null, notes || null]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Employees] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create employee' }, { status: 500 });
  }
}

// PUT /api/employees
export async function PUT(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    const allowedFields = ['full_name', 'email', 'phone', 'role_id', 'department_id', 'employment_status', 'employment_type', 'salary', 'salary_currency', 'hired_date', 'end_date', 'manager_id', 'notes'];
    const fields = [];
    const values = [];
    let idx = 1;

    for (const f of allowedFields) {
      if (body[f] !== undefined) { fields.push(`${f} = $${idx++}`); values.push(body[f] || null); }
    }
    fields.push(`updated_at = NOW()`);

    if (fields.length <= 1) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });

    values.push(id);
    const result = await query(`UPDATE employees SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update employee' }, { status: 500 });
  }
}
