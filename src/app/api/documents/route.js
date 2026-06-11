import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/documents
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'documents.view');
    if (perm instanceof NextResponse) return perm;

    const { searchParams } = new URL(request.url);
    const category    = searchParams.get('category');
    const folder_id   = searchParams.get('folder_id');
    const entity_type = searchParams.get('entity_type');
    const entity_id   = searchParams.get('entity_id');
    const status      = searchParams.get('approval_status');
    const search      = searchParams.get('search');

    let sql = `
      SELECT d.*,
             u.full_name AS uploaded_by_name,
             f.name      AS folder_name,
             COALESCE(
               (SELECT json_agg(t.name)
                FROM document_tag_links l
                JOIN document_tags t ON t.id = l.tag_id
                WHERE l.document_id = d.id),
               '[]'
             ) AS tag_names
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN document_folders f ON d.folder_id = f.id
      WHERE 1=1
    `;
    const params = [];
    if (category)    { params.push(category);    sql += ` AND d.category = $${params.length}`; }
    if (folder_id)   { params.push(folder_id);   sql += ` AND d.folder_id = $${params.length}`; }
    if (entity_type) { params.push(entity_type); sql += ` AND d.entity_type = $${params.length}`; }
    if (entity_id)   { params.push(entity_id);   sql += ` AND d.entity_id = $${params.length}`; }
    if (status)      { params.push(status);      sql += ` AND d.approval_status = $${params.length}`; }
    if (search)      {
      params.push(`%${search}%`);
      sql += ` AND (d.title ILIKE $${params.length} OR d.description ILIKE $${params.length} OR d.body ILIKE $${params.length})`;
    }
    sql += ` ORDER BY d.updated_at DESC NULLS LAST, d.created_at DESC LIMIT 200`;

    const result = await query(sql, params);
    const counts = await query(`SELECT category, COUNT(*) AS count FROM documents GROUP BY category`);
    const statusCounts = await query(`SELECT approval_status, COUNT(*) AS count FROM documents GROUP BY approval_status`);

    return NextResponse.json({
      success: true,
      data: result.rows,
      categories: counts.rows,
      approval_statuses: statusCounts.rows,
    });
  } catch (error) {
    console.error('[Documents] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch documents' }, { status: 500 });
  }
}

// POST /api/documents
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'documents.create');
    if (perm instanceof NextResponse) {
      const fb = await requirePermission(request, 'documents.manage');
      if (fb instanceof NextResponse) return fb;
    }
    const auth = (perm instanceof NextResponse
      ? await requirePermission(request, 'documents.manage')
      : perm).auth;

    const body = await request.json();
    const {
      title, category = 'general', folder_id, entity_type, entity_id,
      file_url, file_name, file_size, mime_type, description, tags,
      body_format = 'markdown', body: contentBody, template_id,
      visibility = 'internal', metadata,
    } = body;
    if (!title) return NextResponse.json({ success: false, error: 'title required' }, { status: 400 });

    const result = await query(
      `INSERT INTO documents
         (title, category, folder_id, entity_type, entity_id,
          file_url, file_name, file_size, mime_type,
          uploaded_by, description, tags, body_format, body, template_id,
          visibility, metadata, current_version, approval_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,1,'draft')
       RETURNING *`,
      [
        title, category, folder_id || null,
        entity_type || null, entity_id || null,
        file_url || null, file_name || null, file_size || null, mime_type || null,
        auth.userId, description || null, tags || null,
        body_format, contentBody || null, template_id || null,
        visibility, JSON.stringify(metadata || {}),
      ]
    );

    // Seed v1 snapshot
    await query(
      `INSERT INTO document_versions
         (document_id, version, title, body, body_format, file_url, file_name, file_size, is_current, created_by)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, TRUE, $8)`,
      [result.rows[0].id, title, contentBody || null, body_format, file_url || null, file_name || null, file_size || null, auth.userId]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Documents] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create document: ' + error.message }, { status: 500 });
  }
}
