import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/documents/search - Advanced search for generated documents
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'documents.view');
    if (perm instanceof NextResponse) return perm;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search');
    const documentType = searchParams.get('document_type');
    const categoryId = searchParams.get('category_id');
    const status = searchParams.get('status');
    const recipientEmail = searchParams.get('recipient_email');
    const recipientName = searchParams.get('recipient_name');
    const generatedBy = searchParams.get('generated_by');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const expiresBefore = searchParams.get('expires_before');

    let where = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
      where += ` AND (title ILIKE $${paramIndex} OR recipient_name ILIKE $${paramIndex} OR recipient_email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (documentType) {
      where += ` AND document_type = $${paramIndex}`;
      params.push(documentType);
      paramIndex++;
    }

    if (categoryId) {
      where += ` AND category_id = $${paramIndex}`;
      params.push(categoryId);
      paramIndex++;
    }

    if (status) {
      where += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (recipientEmail) {
      where += ` AND recipient_email ILIKE $${paramIndex}`;
      params.push(`%${recipientEmail}%`);
      paramIndex++;
    }

    if (recipientName) {
      where += ` AND recipient_name ILIKE $${paramIndex}`;
      params.push(`%${recipientName}%`);
      paramIndex++;
    }

    if (generatedBy) {
      where += ` AND generated_by = $${paramIndex}`;
      params.push(generatedBy);
      paramIndex++;
    }

    if (dateFrom) {
      where += ` AND generated_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      where += ` AND generated_at <= $${paramIndex}`;
      params.push(dateTo + ' 23:59:59');
      paramIndex++;
    }

    if (expiresBefore) {
      where += ` AND expires_at <= $${paramIndex}`;
      params.push(expiresBefore);
      paramIndex++;
    }

    // Get total count
    const countRes = await query(
      `SELECT COUNT(*) as total FROM generated_documents gd ${where}`,
      params
    );

    // Get data with joins
    const dataRes = await query(
      `SELECT
        gd.*,
        dt.name as template_name,
        dc.name as category_name,
        db.organization_name as branding_name
       FROM generated_documents gd
       LEFT JOIN document_templates dt ON gd.template_id = dt.id
       LEFT JOIN document_categories dc ON gd.category_id = dc.id
       LEFT JOIN document_branding db ON gd.branding_id = db.id
       ${where}
       ORDER BY gd.generated_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      success: true,
      data: dataRes.rows,
      total: parseInt(countRes.rows[0].total),
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Documents/Search] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search documents' },
      { status: 500 }
    );
  }
}