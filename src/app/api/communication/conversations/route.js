import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import {
  createConversation,
  getUserConversations,
  getConversationDetails,
  logCommunicationAudit,
  isParticipant,
} from '@/lib/communication-utils.js';

/**
 * GET /api/communication/conversations
 * Get all conversations for current user
 */
export async function GET(req) {
  try {
    const perm = await requirePermission(req, 'communication.view_conversations');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;
    
    const conversations = await getUserConversations(userId);
    
    return NextResponse.json({
      success: true,
      data: conversations,
      count: conversations.length,
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/communication/conversations
 * Create a new conversation
 */
export async function POST(req) {
  try {
    const perm = await requirePermission(req, 'communication.create_conversation');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;
    const body = await req.json();
    const { type, name, participants: rawParticipants, member_ids } = body;
    const participants = rawParticipants || member_ids || [];
    
    // Validation
    if (!type || !['direct', 'group', 'department'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid conversation type' },
        { status: 400 }
      );
    }
    
    if (type === 'direct') {
      if (!participants || participants.length !== 1) {
        return NextResponse.json(
          { success: false, error: 'Direct conversation requires exactly 1 other participant' },
          { status: 400 }
        );
      }
    }
    
    if (type === 'group' || type === 'department') {
      if (!name) {
        return NextResponse.json(
          { success: false, error: 'Group/department conversation requires a name' },
          { status: 400 }
        );
      }
    }
    
    // Create conversation
    const conversation = await createConversation({
      type,
      name: type !== 'direct' ? name : null,
      createdBy: userId,
      participants: participants || [userId],
    });
    
    // Fetch full details
    const details = await getConversationDetails(conversation.id, userId);
    
    return NextResponse.json({
      success: true,
      data: details,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
