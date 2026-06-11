import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { updateUserPresence, getUserPresence } from '@/lib/communication-utils.js';

/**
 * POST /api/communication/presence
 * Update user online/offline status
 */
export async function POST(req) {
  try {
    const auth = await requirePermission(req, 'communication.view_conversations');
    if (auth.status === 403) return auth;
    
    const { userId } = auth;
    const body = await req.json();
    const { isOnline, deviceType } = body;
    
    const presence = await updateUserPresence(userId, isOnline, deviceType);
    
    return NextResponse.json({
      success: true,
      presence,
    });
  } catch (error) {
    console.error('Error updating presence:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/communication/presence/[userId]
 * Get user presence
 */
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const userIdParam = url.pathname.split('/').pop();
    
    const presence = await getUserPresence(userIdParam);
    
    if (!presence) {
      return NextResponse.json({
        success: true,
        presence: { is_online: false },
      });
    }
    
    return NextResponse.json({
      success: true,
      presence,
    });
  } catch (error) {
    console.error('Error fetching presence:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
