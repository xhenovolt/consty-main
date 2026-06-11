import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { updateMessageStatus } from '@/lib/communication-utils.js';

/**
 * PUT /api/communication/message-status
 * Update message read/delivery status
 */
export async function PUT(req) {
  try {
    const auth = await requirePermission(req, 'communication.view_conversations');
    if (auth.status === 403) return auth;
    
    const { userId } = auth;
    const body = await req.json();
    const { messageId, status } = body;
    
    if (!messageId || !status) {
      return NextResponse.json(
        { success: false, error: 'messageId and status are required' },
        { status: 400 }
      );
    }
    
    if (!['sent', 'delivered', 'seen'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }
    
    const result = await updateMessageStatus(messageId, userId, status);
    
    return NextResponse.json({
      success: true,
      status: result,
    });
  } catch (error) {
    console.error('Error updating message status:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
