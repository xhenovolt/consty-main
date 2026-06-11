import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/knowledge-base/[id] — Single article
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'knowledge.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const result = await query(`SELECT * FROM knowledge_articles WHERE id = $1`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 });

    // Increment view count
    await query(`UPDATE knowledge_articles SET view_count = view_count + 1 WHERE id = $1`, [id]);

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch article' }, { status: 500 });
  }
}

// PUT /api/knowledge-base/[id] — Update article
export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'knowledge.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    const body = await request.json();
    const fields = [];
    const values = [];
    let idx = 1;

    if (body.title) { fields.push(`title = $${idx++}`); values.push(body.title); }
    if (body.content) { fields.push(`content = $${idx++}`); values.push(body.content); }
    if (body.category) { fields.push(`category = $${idx++}`); values.push(body.category); }
    if (body.tags !== undefined) { fields.push(`tags = $${idx++}`); values.push(body.tags); }
    if (body.is_published !== undefined) { fields.push(`is_published = $${idx++}`); values.push(body.is_published); }
    fields.push(`updated_at = NOW()`);

    values.push(id);
    const result = await query(`UPDATE knowledge_articles SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update article' }, { status: 500 });
  }
}

// DELETE /api/knowledge-base/[id]
export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'knowledge.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;
    await query(`DELETE FROM knowledge_articles WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete article' }, { status: 500 });
  }
}
