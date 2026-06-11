import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { isParticipant, logCommunicationAudit } from '@/lib/communication-utils.js';

/**
 * PATCH /api/communication/conversations/[conversationId]
 * Archive/unarchive a conversation
 */
export async function PATCH(req, { params }) {
  try {
    const perm = await requirePermission(req, 'communication.view_conversations');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;
    const { conversationId } = await params;

    const isMember = await isParticipant(conversationId, userId);
    if (!isMember) {
      return NextResponse.json(
        { success: false, error: 'Not a member of this conversation' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { is_archived } = body;

    if (typeof is_archived !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'is_archived must be a boolean' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE conversations SET is_archived = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, is_archived`,
      [is_archived, conversationId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    await logCommunicationAudit({
      userId,
      action: is_archived ? 'conversation_archived' : 'conversation_unarchived',
      entityType: 'conversation',
      entityId: conversationId,
    });

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: is_archived ? 'Conversation archived' : 'Conversation unarchived',
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/communication/conversations/[conversationId]
 * Soft-delete a conversation (owner or superadmin only)
 */
export async function DELETE(req, { params }) {
  try {
    const perm = await requirePermission(req, 'communication.view_conversations');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;
    const { conversationId } = await params;

    // Check ownership or superadmin
    const conv = await query(
      'SELECT created_by FROM conversations WHERE id = $1 AND deleted_at IS NULL',
      [conversationId]
    );

    if (conv.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Get user role
    const userResult = await query('SELECT role FROM users WHERE id = $1', [userId]);
    const userRole = userResult.rows[0]?.role;

    if (conv.rows[0].created_by !== userId && userRole !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Only conversation creator or superadmin can delete' },
        { status: 403 }
      );
    }

    await query(
      `UPDATE conversations SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );

    await logCommunicationAudit({
      userId,
      action: 'conversation_deleted',
      entityType: 'conversation',
      entityId: conversationId,
    });

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
