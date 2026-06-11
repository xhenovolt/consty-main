import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/departments/[id]/kpis
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'departments.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const result = await query(`SELECT * FROM department_kpis WHERE department_id = $1 ORDER BY created_at DESC`, [id]);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch KPIs' }, { status: 500 });
  }
}

// POST /api/departments/[id]/kpis
export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'departments.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const { name, description, target_value, unit, period } = await request.json();
    if (!name?.trim()) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    const result = await query(
      `INSERT INTO department_kpis (department_id, name, description, target_value, unit, period) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, name.trim(), description || null, target_value || null, unit || null, period || 'monthly']
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create KPI' }, { status: 500 });
  }
}
