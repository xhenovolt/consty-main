import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import {
  addConversationParticipant,
  removeConversationParticipant,
  logCommunicationAudit,
} from '@/lib/communication-utils.js';
import { query } from '@/lib/db.js';

/**
 * POST /api/communication/participants
 * Add/remove participants from conversation
 */
export async function POST(req) {
  try {
    const auth = await requirePermission(req, 'communication.manage_participants');
    if (auth.status === 403) return auth;
    
    const { userId } = auth;
    const body = await req.json();
    const { conversationId, userIdToAdd, action = 'add' } = body;
    
    if (!conversationId || !userIdToAdd) {
      return NextResponse.json(
        { success: false, error: 'conversationId and userIdToAdd are required' },
        { status: 400 }
      );
    }
    
    // Verify user is admin of conversation
    const admin = await db.query(
      `SELECT role FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND is_active = TRUE`,
      [conversationId, userId]
    );
    
    if (admin.rows.length === 0 || admin.rows[0].role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Only conversation admin can add/remove participants' },
        { status: 403 }
      );
    }
    
    let result;
    
    if (action === 'add') {
      result = await addConversationParticipant(conversationId, userIdToAdd);
      await logCommunicationAudit({
        userId,
        action: 'participant_added',
        entityType: 'conversation_participant',
        entityId: result.id,
        conversationId,
        details: { added_user_id: userIdToAdd },
      });
    } else if (action === 'remove') {
      result = await removeConversationParticipant(conversationId, userIdToAdd);
      await logCommunicationAudit({
        userId,
        action: 'participant_removed',
        entityType: 'conversation_participant',
        conversationId,
        details: { removed_user_id: userIdToAdd },
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      participant: result,
    });
  } catch (error) {
    console.error('Error managing participant:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
