import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import {
  deleteMessage,
  logCommunicationAudit,
} from '@/lib/communication-utils.js';
import { query } from '@/lib/db.js';

/**
 * PUT /api/communication/messages/[id]
 * Edit an existing message
 */
export async function PUT(req, { params }) {
  try {
    const perm = await requirePermission(req, 'communication.edit_message');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;
    const { id: messageId } = await params;
    const body = await req.json();
    const { content } = body;
    
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }
    
    // Verify user is message sender
    const message = await query(
      'SELECT sender_id FROM messages WHERE id = $1',
      [messageId]
    );
    
    if (message.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }
    
    if (message.rows[0].sender_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Can only edit your own messages' },
        { status: 403 }
      );
    }
    
    const result = await query(
      `UPDATE messages SET content = $1, edited_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [content, messageId]
    );
    
    await logCommunicationAudit({
      userId,
      action: 'message_edited',
      entityType: 'message',
      entityId: messageId,
    });
    
    return NextResponse.json({
      success: true,
      message: result.rows[0],
    });
  } catch (error) {
    console.error('Error editing message:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/communication/messages/[id]
 * Delete a message
 */
export async function DELETE(req, { params }) {
  try {
    const perm = await requirePermission(req, 'communication.delete_message');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;
    const { id: messageId } = await params;
    
    const message = await deleteMessage(messageId, userId);
    
    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.message.includes('not found') ? 404 : 403 }
    );
  }
}
