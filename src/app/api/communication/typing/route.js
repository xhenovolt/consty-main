import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { updateTypingIndicator, getTypingUsers, isParticipant } from '@/lib/communication-utils.js';

/**
 * POST /api/communication/typing
 * Update typing indicator
 */
export async function POST(req) {
  try {
    const auth = await requirePermission(req, 'communication.view_conversations');
    if (auth.status === 403) return auth;
    
    const { userId } = auth;
    const body = await req.json();
    const { conversationId } = body;
    
    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId is required' },
        { status: 400 }
      );
    }
    
    // Verify user is participant
    const isPartOfConv = await isParticipant(conversationId, userId);
    if (!isPartOfConv) {
      return NextResponse.json(
        { success: false, error: 'User is not a participant' },
        { status: 403 }
      );
    }
    
    await updateTypingIndicator(conversationId, userId);
    
    // Get all currently typing users
    const typingUsers = await getTypingUsers(conversationId);
    
    return NextResponse.json({
      success: true,
      typingUsers,
    });
  } catch (error) {
    console.error('Error updating typing indicator:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/communication/typing/[conversationId]
 * Get users currently typing in conversation
 */
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const conversationId = url.pathname.split('/').pop();
    
    const typingUsers = await getTypingUsers(conversationId);
    
    return NextResponse.json({
      success: true,
      typingUsers,
    });
  } catch (error) {
    console.error('Error fetching typing indicators:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
