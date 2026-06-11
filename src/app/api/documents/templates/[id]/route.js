import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/documents/templates/[id] - Get single template
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'documents.view');
    if (perm instanceof NextResponse) return perm;

    const { id } = await params;

    const result = await query(
      `SELECT * FROM document_templates WHERE id = $1`,
      [id]
    );

    if (!result.rows[0]) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[Documents/Templates/[id]] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

// PUT /api/documents/templates/[id] - Update template
export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'documents.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const { name, description, category, body, body_format, variables, is_active } = await request.json();

    const result = await query(
      `UPDATE document_templates
       SET name = $1, description = $2, category = $3, body = $4,
           body_format = $5, variables = $6, is_active = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        name,
        description,
        category,
        body,
        body_format || 'html',
        variables ? JSON.stringify(variables) : null,
        is_active !== undefined ? is_active : true,
        id
      ]
    );

    if (!result.rows[0]) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[Documents/Templates/[id]] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE /api/documents/templates/[id] - Delete template
export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'documents.manage');
    if (perm instanceof NextResponse) return perm;

    const { id } = await params;

    // Check if template is being used by any generated documents
    const usageCheck = await query(
      `SELECT COUNT(*) as count FROM generated_documents WHERE template_id = $1`,
      [id]
    );

    if (usageCheck.rows[0].count > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete template that is being used by generated documents' },
        { status: 409 }
      );
    }

    const result = await query(
      `DELETE FROM document_templates WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (!result.rows[0]) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('[Documents/Templates/[id]] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}