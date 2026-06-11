import { query } from '@/lib/db';

/**
 * Create a notification that gets auto-delivered via SSE (PG LISTEN/NOTIFY trigger)
 */
export async function createNotification({
  recipientUserId,
  actorUserId,
  type,
  title,
  message,
  referenceType = null,
  referenceId = null,
  priority = 'normal',
  actionUrl = null,
}) {
  try {
    await query(
      `INSERT INTO notifications (recipient_user_id, actor_user_id, type, title, message,
        reference_type, reference_id, priority, action_url, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, NOW())`,
      [recipientUserId, actorUserId, type, title, message, referenceType, referenceId, priority, actionUrl]
    );
  } catch (err) {
    console.error('[Notification] Failed to create:', err.message);
    // Don't throw — notifications should never break the main action
  }
}

/**
 * Notify about a new message in a conversation
 */
export async function notifyNewMessage({ senderUserId, senderName, recipientUserId, conversationId, messagePreview }) {
  await createNotification({
    recipientUserId,
    actorUserId: senderUserId,
    type: 'communication',
    title: `New message from ${senderName}`,
    message: messagePreview?.substring(0, 100) || 'Sent a message',
    referenceType: 'conversation',
    referenceId: conversationId,
    actionUrl: '/app/communication',
  });
}

/**
 * Notify about an incoming call
 */
export async function notifyIncomingCall({ callerUserId, callerName, recipientUserId, callType = 'audio' }) {
  await createNotification({
    recipientUserId,
    actorUserId: callerUserId,
    type: 'communication',
    title: `Incoming ${callType} call`,
    message: `${callerName} is calling you`,
    referenceType: 'call',
    priority: 'high',
    actionUrl: '/app/communication',
  });
}

/**
 * Notify about a missed call
 */
export async function notifyMissedCall({ callerUserId, callerName, recipientUserId, callType = 'audio' }) {
  await createNotification({
    recipientUserId,
    actorUserId: callerUserId,
    type: 'communication',
    title: `Missed ${callType} call`,
    message: `You missed a call from ${callerName}`,
    referenceType: 'call',
    priority: 'normal',
    actionUrl: '/app/communication',
  });
}

/**
 * Notify about a file shared in chat
 */
export async function notifyFileShared({ senderUserId, senderName, recipientUserId, conversationId, fileName }) {
  await createNotification({
    recipientUserId,
    actorUserId: senderUserId,
    type: 'communication',
    title: `${senderName} shared a file`,
    message: fileName || 'Shared a file',
    referenceType: 'conversation',
    referenceId: conversationId,
    actionUrl: '/app/communication',
  });
}
