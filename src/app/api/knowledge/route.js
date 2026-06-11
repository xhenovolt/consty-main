import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/knowledge
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'knowledge.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const system_id = searchParams.get('system_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let sql = `
      SELECT ka.*,
        s.name as system_name,
        u.full_name as author_name
      FROM knowledge_assets ka
      LEFT JOIN systems s ON ka.system_id = s.id
      LEFT JOIN users u ON ka.author_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (category) { params.push(category); sql += ` AND ka.category = $${params.length}`; }
    if (system_id) { params.push(system_id); sql += ` AND ka.system_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND ka.status = $${params.length}`; }
    if (search) { params.push(`%${search}%`); sql += ` AND (ka.title ILIKE $${params.length} OR ka.content ILIKE $${params.length})`; }

    sql += ` ORDER BY ka.updated_at DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Knowledge] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch knowledge assets' }, { status: 500 });
  }
}

// POST /api/knowledge
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'knowledge.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { title, category, system_id, visibility, content, status, tags } = body;

    if (!title || !category) {
      return NextResponse.json({ success: false, error: 'title and category are required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO knowledge_assets (title, category, system_id, author_id, visibility, content, status, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [title, category, system_id || null, auth.userId,
       visibility || 'internal', content || '', status || 'draft',
       tags ? `{${tags.split(',').map(t => `"${t.trim()}"`).join(',')}}` : '{}']
    );

    // Save initial version
    await query(
      `INSERT INTO knowledge_versions (knowledge_id, version, content, edited_by) VALUES ($1,1,$2,$3)`,
      [result.rows[0].id, content || '', auth.userId]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'knowledge_asset', result.rows[0].id, JSON.stringify({ title, category })]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Knowledge] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create knowledge asset' }, { status: 500 });
  }
}

// PATCH /api/knowledge
export async function PATCH(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const allowed = ['title','category','system_id','visibility','content','status','tags'];
    const updates = [];
    const values = [];

    allowed.forEach(f => {
      if (fields[f] !== undefined) {
        if (f === 'tags' && typeof fields[f] === 'string') {
          values.push(`{${fields[f].split(',').map(t => `"${t.trim()}"`).join(',')}}`);
        } else {
          values.push(fields[f]);
        }
        updates.push(`${f} = $${values.length}`);
      }
    });

    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });

    // Auto-increment version if content is changing
    if (fields.content !== undefined) {
      updates.push('version = version + 1');
    }
    updates.push('updated_at = NOW()');
    values.push(id);

    const result = await query(`UPDATE knowledge_assets SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    // Save version snapshot if content changed
    if (fields.content !== undefined) {
      await query(
        `INSERT INTO knowledge_versions (knowledge_id, version, content, edited_by) VALUES ($1,$2,$3,$4)`,
        [id, result.rows[0].version, fields.content, auth.userId]
      );
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Knowledge] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update knowledge asset' }, { status: 500 });
  }
}

// DELETE /api/knowledge?id=xxx
export async function DELETE(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    await query(`DELETE FROM knowledge_assets WHERE id=$1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
  }
}
