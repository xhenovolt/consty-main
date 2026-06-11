import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/departments/[id]/policies
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'departments.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const result = await query(`SELECT * FROM department_policies WHERE department_id = $1 ORDER BY created_at DESC`, [id]);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch policies' }, { status: 500 });
  }
}

// POST /api/departments/[id]/policies
export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'departments.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const { title, content, document_url } = await request.json();
    if (!title?.trim()) return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });
    const result = await query(
      `INSERT INTO department_policies (department_id, title, content, document_url, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, title.trim(), content || null, document_url || null, auth.userId]
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create policy' }, { status: 500 });
  }
}
