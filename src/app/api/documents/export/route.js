import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/documents/export - Export logs/reports
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'documents.manage');
    if (perm instanceof NextResponse) return perm;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'audit_logs'; // audit_logs, verification_logs, documents
    const format = searchParams.get('format') || 'csv'; // csv, json
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const documentId = searchParams.get('document_id');

    let sql = '';
    let params = [];
    let paramIndex = 1;
    let filename = '';

    switch (type) {
      case 'audit_logs':
        sql = `
          SELECT
            al.created_at,
            al.action,
            gd.unique_id as document_id,
            gd.title as document_title,
            u.full_name as actor_name,
            al.ip_address,
            al.details
          FROM document_audit_logs al
          LEFT JOIN generated_documents gd ON al.document_id = gd.id
          LEFT JOIN users u ON al.actor_id = u.id
          WHERE 1=1
        `;
        filename = 'document-audit-logs';
        break;

      case 'verification_logs':
        sql = `
          SELECT
            vl.verified_at,
            gd.unique_id as document_id,
            gd.title as document_title,
            vl.ip_address,
            vl.user_agent,
            vl.verification_status
          FROM document_verification_logs vl
          JOIN generated_documents gd ON vl.document_id = gd.id
          WHERE 1=1
        `;
        filename = 'document-verification-logs';
        break;

      case 'documents':
        sql = `
          SELECT
            gd.unique_id,
            gd.title,
            gd.document_type,
            dc.name as category,
            gd.recipient_name,
            gd.recipient_email,
            gd.generated_at,
            gd.status,
            gd.expires_at,
            gd.viewed_count,
            gd.last_viewed_at,
            dt.name as template_name
          FROM generated_documents gd
          LEFT JOIN document_categories dc ON gd.category_id = dc.id
          LEFT JOIN document_templates dt ON gd.template_id = dt.id
          WHERE 1=1
        `;
        filename = 'generated-documents';
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid export type' },
          { status: 400 }
        );
    }

    // Add filters
    if (dateFrom) {
      sql += ` AND created_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      sql += ` AND created_at <= $${paramIndex}`;
      params.push(dateTo + ' 23:59:59');
      paramIndex++;
    }

    if (documentId && (type === 'audit_logs' || type === 'verification_logs')) {
      sql += ` AND gd.unique_id = $${paramIndex}`;
      params.push(documentId);
      paramIndex++;
    }

    sql += ` ORDER BY created_at DESC LIMIT 10000`; // Limit to prevent huge exports

    const result = await query(sql, params);

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: result.rows,
        total: result.rows.length,
        type,
        exported_at: new Date().toISOString()
      });
    } else if (format === 'csv') {
      // Generate CSV
      if (result.rows.length === 0) {
        return new NextResponse('', {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${filename}.csv"`,
          },
        });
      }

      const headers = Object.keys(result.rows[0]).join(',');
      const rows = result.rows.map(row =>
        Object.values(row).map(value =>
          typeof value === 'object' ? JSON.stringify(value) : String(value || '')
        ).map(val => `"${val.replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      const csv = `${headers}\n${rows}`;

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Use csv or json' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('[Documents/Export] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export data' },
      { status: 500 }
    );
  }
}