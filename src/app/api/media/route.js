import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/media
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'media.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const entity_type = searchParams.get('entity_type');
    const entity_id = searchParams.get('entity_id');
    const tag = searchParams.get('tag');

    let sql = `SELECT * FROM media WHERE 1=1`;
    const params = [];
    if (entity_type) { params.push(entity_type); sql += ` AND entity_type = $${params.length}`; }
    if (entity_id) { params.push(entity_id); sql += ` AND entity_id = $${params.length}`; }
    if (tag) { params.push(tag); sql += ` AND $${params.length} = ANY(tags)`; }
    sql += ` ORDER BY created_at DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Media] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch media' }, { status: 500 });
  }
}

// POST /api/media — record uploaded file metadata
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'media.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { filename, original_filename, mime_type, file_size, storage_provider, cloudinary_account,
            public_id, url, secure_url, thumbnail_url, width, height, format,
            entity_type, entity_id, tags, quality, notes } = body;

    if (!filename || !url) {
      return NextResponse.json({ success: false, error: 'filename and url are required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO media (filename, original_filename, mime_type, file_size, storage_provider, cloudinary_account,
        public_id, url, secure_url, thumbnail_url, width, height, format,
        entity_type, entity_id, tags, quality, notes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [filename, original_filename || filename, mime_type || null, file_size || null,
       storage_provider || 'cloudinary', cloudinary_account || null,
       public_id || null, url, secure_url || url, thumbnail_url || null,
       width || null, height || null, format || null,
       entity_type || null, entity_id || null,
       tags || '{}', quality || 'original', notes || null, auth.userId]
    );

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'media', result.rows[0].id, JSON.stringify({ filename, entity_type })]);

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Media] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save media record' }, { status: 500 });
  }
}

// DELETE /api/media?id=xxx
export async function DELETE(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    await query(`DELETE FROM media WHERE id=$1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete media' }, { status: 500 });
  }
}
