import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUserOrThrow } from '@/lib/current-user';
import { notifyIncomingCall } from '@/lib/communication-notifications';

/**
 * POST /api/communication/calls/signal — WebRTC signaling endpoint
 * Handles offer, answer, and ICE candidate exchange
 * Uses polling-based signaling (no WebSocket server needed)
 */
export async function POST(request) {
  try {
    const user = await getCurrentUserOrThrow();
    const body = await request.json();
    const { callId, type, payload, targetUserId } = body;

    if (!callId || !type || !payload) {
      return NextResponse.json({ error: 'callId, type, and payload are required' }, { status: 400 });
    }

    const validTypes = ['offer', 'answer', 'ice-candidate', 'screen-share-start', 'screen-share-stop'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid signal type' }, { status: 400 });
    }

    // Store signal in call metadata
    await query(
      `UPDATE call_logs 
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}'::jsonb),
         $1,
         $2::jsonb
       )
       WHERE id = $3`,
      [
        `{signals,${user.id}_${type}_${Date.now()}}`,
        JSON.stringify({ type, payload, from: user.id, to: targetUserId, timestamp: new Date().toISOString() }),
        callId,
      ]
    );

    // Notify the target user for offers (incoming call)
    if (type === 'offer' && targetUserId) {
      notifyIncomingCall({
        callerUserId: user.id,
        callerName: user.full_name || user.name || 'Unknown',
        recipientUserId: targetUserId,
        callType: payload.video ? 'video' : 'audio',
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Signaling error:', err);
    return NextResponse.json({ error: 'Signaling failed' }, { status: 500 });
  }
}

/**
 * GET /api/communication/calls/signal — Poll for signals
 */
export async function GET(request) {
  try {
    const user = await getCurrentUserOrThrow();
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');

    if (!callId) {
      return NextResponse.json({ error: 'callId is required' }, { status: 400 });
    }

    const result = await query(
      'SELECT metadata FROM call_logs WHERE id = $1',
      [callId]
    );

    const signals = result.rows[0]?.metadata?.signals || {};
    
    // Filter signals meant for this user
    const mySignals = Object.values(signals).filter(
      s => s.to === user.id || !s.to
    );

    return NextResponse.json({
      success: true,
      data: mySignals,
    });
  } catch (err) {
    if (err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}
