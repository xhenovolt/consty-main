import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { dispatch } from '@/lib/system-events.js';
import { hasPermission } from '@/lib/permissions.js';

// "Can this user moderate other people's comments?" Returns true for any
// role with comments.moderate OR comments.manage_others (and superadmins
// because hasPermission bypasses them internally).
async function canModerateComments(auth) {
  return (await hasPermission(auth.userId, 'comments', 'moderate', auth.role))
      || (await hasPermission(auth.userId, 'comments', 'manage_others', auth.role));
}

const VALID_ENTITY_TYPES = [
  'deal', 'prospect', 'client', 'system', 'invoice', 'payment',
  'obligation', 'service', 'product', 'knowledge_article', 'bug_report',
  'feature_request', 'decision_log', 'staff', 'department',
];

/**
 * GET /api/comments?entity_type=deal&entity_id=xxx
 * List comments for a specific entity, with author info and threading
 */
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');

    if (!entityType || !entityId) {
      return NextResponse.json({ success: false, error: 'entity_type and entity_id required' }, { status: 400 });
    }

    const result = await query(
      `SELECT rc.*, u.name as author_name, u.email as author_email,
              ru.name as resolved_by_name
       FROM record_comments rc
       LEFT JOIN users u ON rc.author_id = u.id
       LEFT JOIN users ru ON rc.resolved_by = ru.id
       WHERE rc.entity_type = $1 AND rc.entity_id = $2
       ORDER BY rc.created_at ASC`,
      [entityType, entityId]
    );

    // Build threaded structure
    const comments = result.rows;
    const topLevel = comments.filter(c => !c.parent_comment_id);
    const replies = comments.filter(c => c.parent_comment_id);

    const threaded = topLevel.map(c => ({
      ...c,
      replies: replies.filter(r => r.parent_comment_id === c.id),
    }));

    return NextResponse.json({ success: true, data: threaded, total: comments.length });
  } catch (error) {
    console.error('[Comments] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch comments' }, { status: 500 });
  }
}

/**
 * POST /api/comments — Create a comment
 * Body: { entity_type, entity_id, content, parent_comment_id?, mentions? }
 */
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { entity_type, entity_id, content, parent_comment_id, mentions } = await request.json();

    if (!entity_type || !entity_id || !content?.trim()) {
      return NextResponse.json({ success: false, error: 'entity_type, entity_id, and content are required' }, { status: 400 });
    }

    if (!VALID_ENTITY_TYPES.includes(entity_type)) {
      return NextResponse.json({ success: false, error: `Invalid entity_type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}` }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO record_comments (entity_type, entity_id, parent_comment_id, author_id, content, mentions)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [entity_type, entity_id, parent_comment_id || null, auth.userId, content.trim(), mentions || []]
    );

    // Get author info
    const author = await query(`SELECT name, email FROM users WHERE id = $1`, [auth.userId]);
    const comment = { ...result.rows[0], author_name: author.rows[0]?.name, author_email: author.rows[0]?.email };

    dispatch('comment_created', {
      entityType: entity_type,
      entityId: entity_id,
      description: `${author.rows[0]?.name || 'Someone'} commented on ${entity_type} record`,
      actorId: auth.userId,
      metadata: { comment_id: comment.id, entity_type, entity_id, is_reply: !!parent_comment_id },
    });

    return NextResponse.json({ success: true, data: comment }, { status: 201 });
  } catch (error) {
    console.error('[Comments] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create comment' }, { status: 500 });
  }
}

/**
 * PATCH /api/comments — Update or resolve a comment
 * Body: { id, content? } OR { id, resolve: true }
 */
export async function PATCH(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id, content, resolve } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    if (resolve) {
      const result = await query(
        `UPDATE record_comments SET is_resolved = true, resolved_by = $1, resolved_at = NOW(), updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [auth.userId, id]
      );
      if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: result.rows[0] });
    }

    if (!content?.trim()) return NextResponse.json({ success: false, error: 'content required' }, { status: 400 });

    // Only author can edit their own comment
    const existing = await query(`SELECT author_id FROM record_comments WHERE id = $1`, [id]);
    if (!existing.rows[0]) return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 });
    if (existing.rows[0].author_id !== auth.userId && !(await canModerateComments(auth))) {
      return NextResponse.json({ success: false, error: 'You can only edit your own comments' }, { status: 403 });
    }

    const result = await query(
      `UPDATE record_comments SET content = $1, is_edited = true, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [content.trim(), id]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Comments] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update comment' }, { status: 500 });
  }
}

/**
 * DELETE /api/comments?id=xxx
 */
export async function DELETE(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    // Only author or superadmin can delete
    const existing = await query(`SELECT author_id FROM record_comments WHERE id = $1`, [id]);
    if (!existing.rows[0]) return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 });
    if (existing.rows[0].author_id !== auth.userId && !(await canModerateComments(auth))) {
      return NextResponse.json({ success: false, error: 'You can only delete your own comments' }, { status: 403 });
    }

    await query(`DELETE FROM record_comments WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Comments] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete comment' }, { status: 500 });
  }
}
