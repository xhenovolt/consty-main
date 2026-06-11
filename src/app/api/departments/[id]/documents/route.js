import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/departments/[id]/documents
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'departments.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const result = await query(
      `SELECT dd.*, m.secure_url, m.mime_type, m.file_size, m.original_filename
       FROM department_documents dd LEFT JOIN media m ON dd.media_id = m.id
       WHERE dd.department_id = $1 ORDER BY dd.created_at DESC`, [id]
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch documents' }, { status: 500 });
  }
}

// POST /api/departments/[id]/documents
export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'departments.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const { title, description, media_id, document_url } = await request.json();
    if (!title?.trim()) return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });
    const result = await query(
      `INSERT INTO department_documents (department_id, title, description, media_id, document_url, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, title.trim(), description || null, media_id || null, document_url || null, auth.userId]
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create document' }, { status: 500 });
  }
}
