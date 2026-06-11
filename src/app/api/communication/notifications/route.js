import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import {
  getUserNotifications,
  markNotificationAsRead,
} from '@/lib/communication-utils.js';

/**
 * GET /api/communication/notifications
 * Get notifications for current user
 */
export async function GET(req) {
  try {
    const auth = await requirePermission(req, 'communication.view_conversations');
    if (auth.status === 403) return auth;
    
    const { userId } = auth;
    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get('unread') === 'true';
    
    const notifications = await getUserNotifications(userId, unreadOnly);
    
    return NextResponse.json({
      success: true,
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/communication/notifications/[id]
 * Mark notification as read
 */
export async function PUT(req) {
  try {
    const auth = await requirePermission(req, 'communication.view_conversations');
    if (auth.status === 403) return auth;
    
    const url = new URL(req.url);
    const notificationId = url.pathname.split('/').pop();
    
    const result = await markNotificationAsRead(notificationId);
    
    return NextResponse.json({
      success: true,
      notification: result,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
