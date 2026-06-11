import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/documents/categories - List all categories
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'documents.view');
    if (perm instanceof NextResponse) return perm;

    const result = await query(
      `SELECT * FROM document_categories
       WHERE is_active = TRUE
       ORDER BY name`
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('[Documents/Categories] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

// POST /api/documents/categories - Create new category
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'documents.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { name, description } = await request.json();

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Category name is required' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO document_categories (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description, auth.userId]
    );

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    }, { status: 201 });
  } catch (error) {
    console.error('[Documents/Categories] POST error:', error);

    if (error.code === '23505') { // Unique constraint violation
      return NextResponse.json(
        { success: false, error: 'Category name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create category' },
      { status: 500 }
    );
  }
}