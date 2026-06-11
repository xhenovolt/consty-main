import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import {
  createCall,
  getCallDetails,
  getCallPermissionsForRole,
  logCommunicationAudit,
  isParticipant,
} from '@/lib/communication-utils.js';
import { query } from '@/lib/db.js';

/**
 * GET /api/communication/calls/[id]
 * Get call details
 */
export async function GET(req, { params }) {
  try {
    const perm = await requirePermission(req, 'communication.view_conversations');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;
    const { id: callId } = await params;
    
    const call = await getCallDetails(callId);
    
    if (!call) {
      return NextResponse.json(
        { success: false, error: 'Call not found' },
        { status: 404 }
      );
    }
    
    // Verify user is in the conversation
    const isPartOfCall = await isParticipant(call.conversation_id, userId);
    if (!isPartOfCall) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }
    
    return NextResponse.json({
      success: true,
      call,
    });
  } catch (error) {
    console.error('Error fetching call:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/communication/calls/[id]
 * Update call status (ended, answered, etc)
 */
export async function PUT(req, { params }) {
  try {
    const perm = await requirePermission(req, 'communication.start_call');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;
    const { id: callId } = await params;
    const body = await req.json();
    const { status, recordingUrl, endTime } = body;
    
    const call = await getCallDetails(callId);
    
    if (!call) {
      return NextResponse.json(
        { success: false, error: 'Call not found' },
        { status: 404 }
      );
    }
    
    // Verify user is in the conversation
    const isPartOfCall = await isParticipant(call.conversation_id, userId);
    if (!isPartOfCall) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Update call
    const result = await query(
      `UPDATE calls SET status = $1 ${recordingUrl ? ', recording_url = $3' : ''} ${endTime ? ', ended_at = NOW()' : ''}
       WHERE id = $2
       RETURNING *`,
      recordingUrl ? [status, callId, recordingUrl] : [status, callId]
    );
    
    await logCommunicationAudit({
      userId,
      action: 'call_updated',
      entityType: 'call',
      entityId: callId,
      conversationId: call.conversation_id,
    });
    
    return NextResponse.json({
      success: true,
      call: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating call:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
