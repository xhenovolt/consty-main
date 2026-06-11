import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/documents/templates - List all templates
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'documents.view');
    if (perm instanceof NextResponse) return perm;

    const result = await query(
      `SELECT * FROM document_templates
       WHERE is_active = TRUE
       ORDER BY name`
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('[Documents/Templates] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST /api/documents/templates - Create new template
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'documents.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { name, description, category, body, body_format, variables } = await request.json();

    if (!name || !body) {
      return NextResponse.json(
        { success: false, error: 'Name and body are required' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO document_templates
        (name, description, category, body, body_format, variables, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name,
        description || null,
        category || null,
        body,
        body_format || 'html',
        variables ? JSON.stringify(variables) : null,
        auth.userId
      ]
    );

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    }, { status: 201 });
  } catch (error) {
    console.error('[Documents/Templates] POST error:', error);

    if (error.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'Template name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create template' },
      { status: 500 }
    );
  }
}