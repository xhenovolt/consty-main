import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/departments/[id]/processes
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'departments.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const result = await query(`SELECT * FROM department_processes WHERE department_id = $1 ORDER BY created_at DESC`, [id]);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch processes' }, { status: 500 });
  }
}

// POST /api/departments/[id]/processes
export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'departments.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const { name, description, steps, status } = await request.json();
    if (!name?.trim()) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    const result = await query(
      `INSERT INTO department_processes (department_id, name, description, steps, status, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, name.trim(), description || null, JSON.stringify(steps || []), status || 'active', auth.userId]
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create process' }, { status: 500 });
  }
}
