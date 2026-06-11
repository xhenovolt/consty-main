/**
 * GET    /api/docs/[id]   — Get single doc by ID or slug (includes full content)
 * PUT    /api/docs/[id]   — Update doc (superadmin only, auto-versions)
 * DELETE /api/docs/[id]   — Archive doc (superadmin only)
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

export async function GET(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    // Support lookup by UUID or slug
    const result = await query(
      `SELECT * FROM docs WHERE id = $1 OR slug = $1`,
      [id]
    );

    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Doc not found' }, { status: 404 });
    }

    // Load versions
    const versions = await query(
      `SELECT id, version, changed_by, created_at FROM doc_versions WHERE doc_id = $1 ORDER BY created_at DESC`,
      [result.rows[0].id]
    );

    return NextResponse.json({
      success: true,
      data: { ...result.rows[0], versions: versions.rows },
    });
  } catch (error) {
    console.error('[API/docs/[id]] GET failed:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to load doc' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    if (!auth.is_superadmin) {
      return NextResponse.json({ success: false, error: 'Superadmin required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, content, category, version, is_public } = body;

    // Fetch current doc to snapshot it
    const existing = await query(`SELECT * FROM docs WHERE id = $1 OR slug = $1`, [id]);
    if (!existing.rows[0]) {
      return NextResponse.json({ success: false, error: 'Doc not found' }, { status: 404 });
    }

    const doc = existing.rows[0];

    // Snapshot current content as a version
    await query(
      `INSERT INTO doc_versions (doc_id, content_snapshot, version, changed_by) VALUES ($1, $2, $3, $4)`,
      [doc.id, doc.content, doc.version, auth.userId]
    );

    const updates = [];
    const values = [];
    let idx = 1;

    if (title !== undefined)     { updates.push(`title = $${idx}`);      values.push(title);      idx++; }
    if (content !== undefined)   { updates.push(`content = $${idx}`);    values.push(content);    idx++; }
    if (category !== undefined)  { updates.push(`category = $${idx}`);   values.push(category);   idx++; }
    if (version !== undefined)   { updates.push(`version = $${idx}`);    values.push(version);    idx++; }
    if (is_public !== undefined) { updates.push(`is_public = $${idx}`);  values.push(is_public);  idx++; }

    updates.push(`updated_at = NOW()`);
    values.push(doc.id);

    await query(`UPDATE docs SET ${updates.join(', ')} WHERE id = $${idx}`, values);

    return NextResponse.json({ success: true, message: 'Doc updated and version saved' });
  } catch (error) {
    console.error('[API/docs/[id]] PUT failed:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to update doc' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || !auth.is_superadmin) {
      return NextResponse.json({ success: false, error: 'Superadmin required' }, { status: 403 });
    }

    const { id } = await params;
    const result = await query(`DELETE FROM docs WHERE id = $1 OR slug = $1 RETURNING id, title`, [id]);

    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Doc not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Doc "${result.rows[0].title}" deleted` });
  } catch (error) {
    console.error('[API/docs/[id]] DELETE failed:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to delete doc' }, { status: 500 });
  }
}
