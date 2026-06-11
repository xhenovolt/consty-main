import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * GET /api/media/stats — storage tracking & statistics
 * Returns total files, images, videos, documents, storage used, by department, by uploader
 */
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'media.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const department_id = searchParams.get('department_id');
    const uploaded_by = searchParams.get('uploaded_by');

    let where = 'WHERE 1=1';
    const params = [];
    if (department_id) { params.push(department_id); where += ` AND m.department_id = $${params.length}`; }
    if (uploaded_by) { params.push(uploaded_by); where += ` AND m.uploaded_by = $${params.length}`; }

    const [totals, byType, byEntity, recentUploads] = await Promise.all([
      query(`
        SELECT
          COUNT(*) AS total_files,
          COALESCE(SUM(file_size), 0) AS total_bytes,
          COUNT(*) FILTER (WHERE mime_type LIKE 'image/%') AS image_count,
          COUNT(*) FILTER (WHERE mime_type LIKE 'video/%') AS video_count,
          COUNT(*) FILTER (WHERE mime_type NOT LIKE 'image/%' AND mime_type NOT LIKE 'video/%') AS document_count,
          COALESCE(SUM(file_size) FILTER (WHERE mime_type LIKE 'image/%'), 0) AS image_bytes,
          COALESCE(SUM(file_size) FILTER (WHERE mime_type LIKE 'video/%'), 0) AS video_bytes,
          COALESCE(SUM(file_size) FILTER (WHERE mime_type NOT LIKE 'image/%' AND mime_type NOT LIKE 'video/%'), 0) AS document_bytes
        FROM media m ${where}
      `, params),
      query(`
        SELECT
          CASE
            WHEN mime_type LIKE 'image/%' THEN 'image'
            WHEN mime_type LIKE 'video/%' THEN 'video'
            WHEN mime_type LIKE 'application/pdf' THEN 'pdf'
            ELSE 'other'
          END AS file_type,
          COUNT(*) AS count,
          COALESCE(SUM(file_size), 0) AS total_bytes
        FROM media m ${where}
        GROUP BY file_type ORDER BY count DESC
      `, params),
      query(`
        SELECT entity_type, COUNT(*) AS count, COALESCE(SUM(file_size), 0) AS total_bytes
        FROM media m ${where} AND entity_type IS NOT NULL
        GROUP BY entity_type ORDER BY count DESC
      `, params),
      query(`
        SELECT m.id, m.original_filename, m.mime_type, m.file_size, m.entity_type, m.created_at,
               u.full_name AS uploaded_by_name
        FROM media m
        LEFT JOIN users u ON m.uploaded_by = u.id
        ${where}
        ORDER BY m.created_at DESC LIMIT 10
      `, params),
    ]);

    // Cloud account usage
    let cloudAccounts = [];
    try {
      const ca = await query(`SELECT account_name, cloud_name, usage_bytes, max_bytes, is_primary, is_active FROM cloud_accounts ORDER BY is_primary DESC`);
      cloudAccounts = ca.rows;
    } catch {}

    return NextResponse.json({
      success: true,
      data: {
        summary: totals.rows[0],
        by_type: byType.rows,
        by_entity: byEntity.rows,
        recent_uploads: recentUploads.rows,
        cloud_accounts: cloudAccounts,
      },
    });
  } catch (error) {
    console.error('[Media Stats] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch media stats' }, { status: 500 });
  }
}
