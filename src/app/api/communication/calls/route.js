import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import {
  createCall,
  getCallPermissionsForRole,
  isParticipant,
} from '@/lib/communication-utils.js';
import { query } from '@/lib/db.js';

/**
 * POST /api/communication/calls
 * Initiate a call
 */
export async function POST(req) {
  try {
    const auth = await requirePermission(req, 'communication.start_call');
    if (auth.status === 403) return auth;
    
    const { userId, roleId } = auth;
    const body = await req.json();
    const { callType, conversationId } = body;
    
    // Validate call type
    if (!['audio', 'video'].includes(callType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid call type' },
        { status: 400 }
      );
    }
    
    // Check call permissions for user's role
    const callPerms = await getCallPermissionsForRole(roleId);
    
    if (callType === 'audio' && !callPerms.can_start_audio_calls) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to start audio calls' },
        { status: 403 }
      );
    }
    
    if (callType === 'video' && !callPerms.can_start_video_calls) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to start video calls' },
        { status: 403 }
      );
    }
    
    // Verify user is participant in conversation
    const isPartOfConv = await isParticipant(conversationId, userId);
    if (!isPartOfConv) {
      return NextResponse.json(
        { success: false, error: 'You are not a member of this conversation' },
        { status: 403 }
      );
    }
    
    // Create call
    const call = await createCall({
      callType,
      conversationId,
      callerId: userId,
    });
    
    return NextResponse.json({
      success: true,
      call,
    }, { status: 201 });
  } catch (error) {
    console.error('Error initiating call:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
