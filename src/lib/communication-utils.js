import { query } from './db.js';

/**
 * Communication System Utilities
 * Handles messaging, calls, presence, and notifications
 */

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

export async function createMessage({
  conversationId,
  senderId,
  content,
  messageType = 'text',
  mediaUrl = null,
  mediaType = null,
  mediaSize = null,
  replyToMessageId = null,
}) {
  const result = await query(
    `INSERT INTO messages (
      conversation_id, sender_id, content, message_type,
      media_url, media_type, media_size, reply_to_message_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, conversation_id, sender_id, content, message_type, created_at`,
    [conversationId, senderId, content, messageType, mediaUrl, mediaType, mediaSize, replyToMessageId]
  );
  
  const message = result.rows[0];
  
  // Update conversation last_message_at
  await query(
    'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
    [conversationId]
  );
  
  // Create message status for all conversation participants
  const participants = await query(
    'SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id != $2',
    [conversationId, senderId]
  );
  
  for (const participant of participants.rows) {
    await query(
      'INSERT INTO message_status (message_id, user_id, status) VALUES ($1, $2, $3)',
      [message.id, participant.user_id, 'sent']
    );
  }
  
  // Log audit
  await logCommunicationAudit({
    userId: senderId,
    action: 'message_sent',
    entityType: 'message',
    entityId: message.id,
    conversationId,
  });
  
  return message;
}

export async function getConversationMessages(conversationId, userId, limit = 30, offset = 0) {
  // Verify user is participant
  const participant = await query(
    'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2 AND is_active = TRUE',
    [conversationId, userId]
  );
  
  if (participant.rows.length === 0) {
    throw new Error('User is not a participant in this conversation');
  }
  
  const result = await query(
    `SELECT m.*, u.email, COALESCE(u.full_name, u.name, s.name) as sender_name,
            (SELECT json_agg(json_build_object('user_id', user_id, 'status', status))
             FROM message_status WHERE message_id = m.id) as status_info
     FROM messages m
     LEFT JOIN users u ON m.sender_id = u.id
     LEFT JOIN staff s ON s.user_id = u.id
     WHERE m.conversation_id = $1 AND m.deleted_at IS NULL
     ORDER BY m.created_at DESC
     LIMIT $2 OFFSET $3`,
    [conversationId, limit, offset]
  );
  
  return result.rows.reverse();
}

export async function updateMessageStatus(messageId, userId, status) {
  const result = await query(
    `UPDATE message_status SET status = $1, updated_at = NOW()
     WHERE message_id = $2 AND user_id = $3
     RETURNING *`,
    [status, messageId, userId]
  );
  
  if (result.rows.length > 0) {
    await logCommunicationAudit({
      userId,
      action: 'message_status_updated',
      entityType: 'message',
      entityId: messageId,
      details: { new_status: status },
    });
  }
  
  return result.rows[0];
}

export async function deleteMessage(messageId, userId) {
  const message = await query(
    'SELECT sender_id FROM messages WHERE id = $1',
    [messageId]
  );
  
  if (message.rows.length === 0) {
    throw new Error('Message not found');
  }
  
  if (message.rows[0].sender_id !== userId) {
    throw new Error('Only message sender can delete');
  }
  
  const result = await query(
    `UPDATE messages SET deleted_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [messageId]
  );
  
  await logCommunicationAudit({
    userId,
    action: 'message_deleted',
    entityType: 'message',
    entityId: messageId,
  });
  
  return result.rows[0];
}

// ============================================================================
// CONVERSATION OPERATIONS
// ============================================================================

export async function createConversation({ type, name, createdBy, participants = [] }) {
  // For direct conversations, check if one already exists between these two users
  if (type === 'direct' && participants.length === 1) {
    const otherUserId = participants[0];
    const existing = await query(
      `SELECT c.* FROM conversations c
       WHERE c.type = 'direct' AND c.deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = c.id AND user_id = $1 AND is_active = TRUE)
       AND EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = c.id AND user_id = $2 AND is_active = TRUE)
       LIMIT 1`,
      [createdBy, otherUserId]
    );
    if (existing.rows.length > 0) {
      return { ...existing.rows[0], existing: true };
    }
  }

  const result = await query(
    `INSERT INTO conversations (type, name, created_by)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [type, name, createdBy]
  );
  
  const conversation = result.rows[0];
  
  // Add creator as admin
  await query(
    `INSERT INTO conversation_participants (conversation_id, user_id, role)
     VALUES ($1, $2, 'admin')`,
    [conversation.id, createdBy]
  );
  
  // Add other participants
  for (const userId of participants) {
    if (userId !== createdBy) {
      await query(
        `INSERT INTO conversation_participants (conversation_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT DO NOTHING`,
        [conversation.id, userId]
      );
    }
  }
  
  await logCommunicationAudit({
    userId: createdBy,
    action: 'conversation_created',
    entityType: 'conversation',
    entityId: conversation.id,
    details: { type, participants: participants.length },
  });
  
  return conversation;
}

export async function getUserConversations(userId, limit = 50) {
  const result = await query(
    `SELECT c.*,
            COALESCE(
              (SELECT COUNT(*) FROM messages m2
               JOIN message_status ms2 ON ms2.message_id = m2.id AND ms2.user_id = $1 AND ms2.status != 'seen'
               WHERE m2.conversation_id = c.id AND m2.deleted_at IS NULL AND m2.sender_id != $1
              ), 0
            )::int as unread_count,
            lm.content as last_message,
            lm.created_at as last_msg_time,
            COALESCE(lu.full_name, lu.name, ls.name) as last_sender_name
     FROM conversations c
     INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
     LEFT JOIN LATERAL (
       SELECT content, sender_id, created_at FROM messages
       WHERE conversation_id = c.id AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 1
     ) lm ON TRUE
     LEFT JOIN users lu ON lm.sender_id = lu.id
     LEFT JOIN staff ls ON ls.user_id = lu.id
     WHERE cp.user_id = $1 AND cp.is_active = TRUE
           AND c.deleted_at IS NULL
     ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
     LIMIT $2`,
    [userId, limit]
  );
  
  return result.rows;
}

export async function getConversationDetails(conversationId, userId) {
  const result = await query(
    `SELECT c.*,
            (
              SELECT json_agg(json_build_object(
                'id', cp.id,
                'user_id', cp.user_id,
                'email', u2.email,
                'full_name', COALESCE(u2.full_name, u2.name, s2.name),
                'role', cp.role,
                'is_online', COALESCE(up2.is_online, FALSE)
              ))
              FROM conversation_participants cp
              LEFT JOIN users u2 ON cp.user_id = u2.id
              LEFT JOIN staff s2 ON s2.user_id = u2.id
              LEFT JOIN user_presence up2 ON cp.user_id = up2.user_id
              WHERE cp.conversation_id = c.id AND cp.is_active = TRUE
            ) as participants
     FROM conversations c
     WHERE c.id = $1`,
    [conversationId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Conversation not found');
  }
  
  return result.rows[0];
}

// ============================================================================
// CALL OPERATIONS
// ============================================================================

export async function createCall({ callType, conversationId, callerId }) {
  const result = await query(
    `INSERT INTO calls (call_type, conversation_id, caller_id, status)
     VALUES ($1, $2, $3, 'ringing')
     RETURNING *`,
    [callType, conversationId, callerId]
  );
  
  const call = result.rows[0];
  
  // Initialize participants
  await query(
    `UPDATE calls SET participants_json = $1 WHERE id = $2`,
    [JSON.stringify([{ user_id: callerId, joined_at: new Date().toISOString() }]), call.id]
  );
  
  await logCommunicationAudit({
    userId: callerId,
    action: 'call_started',
    entityType: 'call',
    entityId: call.id,
    conversationId,
    details: { call_type: callType },
  });
  
  return call;
}

export async function updateCallStatus(callId, status, endTime = null) {
  const sql = endTime
    ? `UPDATE calls SET status = $1, ended_at = $2, duration_seconds = EXTRACT(EPOCH FROM ($2 - started_at))::INT
       WHERE id = $3 RETURNING *`
    : `UPDATE calls SET status = $1, started_at = NOW() WHERE id = $2 RETURNING *`;
  
  const params = endTime ? [status, endTime, callId] : [status, callId];
  
  const result = await query(sql, params);
  return result.rows[0];
}

export async function getCallDetails(callId) {
  const result = await query('SELECT * FROM calls WHERE id = $1', [callId]);
  return result.rows[0];
}

// ============================================================================
// USER PRESENCE OPERATIONS
// ============================================================================

export async function updateUserPresence(userId, isOnline, deviceInfo = null) {
  const result = await query(
    `INSERT INTO user_presence (user_id, is_online, device_info, last_seen, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       is_online = $2,
       device_info = $3,
       last_seen = NOW(),
       updated_at = NOW()
     RETURNING *`,
    [userId, isOnline, deviceInfo]
  );
  
  return result.rows[0];
}

export async function getUserPresence(userId) {
  const result = await query(
    'SELECT is_online, last_seen, device_info FROM user_presence WHERE user_id = $1',
    [userId]
  );
  
  return result.rows[0] || { is_online: false, last_seen: null };
}

// ============================================================================
// NOTIFICATION OPERATIONS
// ============================================================================

export async function createNotification({
  userId,
  notificationType,
  messageId = null,
  callId = null,
  conversationId = null,
  fromUserId = null,
  title,
  body,
}) {
  const result = await query(
    `INSERT INTO communication_notifications (
      user_id, notification_type, message_id, call_id,
      conversation_id, from_user_id, title, body
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [userId, notificationType, messageId, callId, conversationId, fromUserId, title, body]
  );
  
  return result.rows[0];
}

export async function getUserNotifications(userId, unreadOnly = false) {
  const sql = unreadOnly
    ? `SELECT * FROM communication_notifications
       WHERE user_id = $1 AND is_read = FALSE
       ORDER BY created_at DESC LIMIT 50`
    : `SELECT * FROM communication_notifications
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 100`;
  
  const result = await query(sql, [userId]);
  return result.rows;
}

export async function markNotificationAsRead(notificationId) {
  const result = await query(
    `UPDATE communication_notifications
     SET is_read = TRUE, read_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [notificationId]
  );
  
  return result.rows[0];
}

// ============================================================================
// MEDIA PERMISSIONS
// ============================================================================

export async function getMediaPermissions() {
  const result = await query(
    'SELECT * FROM media_permissions WHERE allowed = TRUE ORDER BY file_type'
  );
  
  return result.rows;
}

export async function updateMediaPermission(fileType, allowed, maxSizeMb) {
  const result = await query(
    `UPDATE media_permissions
     SET allowed = $1, max_size_mb = $2, updated_at = NOW()
     WHERE file_type = $3
     RETURNING *`,
    [allowed, maxSizeMb, fileType]
  );
  
  return result.rows[0];
}

// ============================================================================
// CALL PERMISSIONS
// ============================================================================

export async function getCallPermissionsForRole(roleId) {
  const result = await query(
    'SELECT * FROM call_permissions WHERE role_id = $1',
    [roleId]
  );
  
  return result.rows[0] || {
    can_start_audio_calls: true,
    can_start_video_calls: true,
    can_record_calls: false,
  };
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export async function logCommunicationAudit({
  userId,
  action,
  entityType,
  entityId,
  conversationId = null,
  details = null,
  ipAddress = null,
  userAgent = null,
}) {
  await query(
    `INSERT INTO communication_audit_log (
      user_id, action, entity_type, entity_id,
      conversation_id, details, ip_address, user_agent
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [userId, action, entityType, entityId, conversationId, details ? JSON.stringify(details) : null, ipAddress, userAgent]
  );
}

// ============================================================================
// TYPING INDICATORS
// ============================================================================

export async function updateTypingIndicator(conversationId, userId) {
  await query(
    `INSERT INTO typing_indicators (conversation_id, user_id, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '3 seconds')
     ON CONFLICT (conversation_id, user_id) DO UPDATE SET
       expires_at = NOW() + INTERVAL '3 seconds'`,
    [conversationId, userId]
  );
}

export async function getTypingUsers(conversationId) {
  const result = await query(
    `SELECT user_id FROM typing_indicators
     WHERE conversation_id = $1 AND expires_at > NOW()`,
    [conversationId]
  );
  
  return result.rows.map(r => r.user_id);
}

// ============================================================================
// PARTICIPANT MANAGEMENT
// ============================================================================

export async function addConversationParticipant(conversationId, userId, role = 'member') {
  const result = await query(
    `INSERT INTO conversation_participants (conversation_id, user_id, role, is_active)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (conversation_id, user_id) DO UPDATE SET is_active = TRUE
     RETURNING *`,
    [conversationId, userId, role]
  );
  
  return result.rows[0];
}

export async function removeConversationParticipant(conversationId, userId) {
  const result = await query(
    `UPDATE conversation_participants
     SET is_active = FALSE, left_at = NOW()
     WHERE conversation_id = $1 AND user_id = $2
     RETURNING *`,
    [conversationId, userId]
  );
  
  return result.rows[0];
}

export async function isParticipant(conversationId, userId) {
  const result = await query(
    `SELECT id FROM conversation_participants
     WHERE conversation_id = $1 AND user_id = $2 AND is_active = TRUE`,
    [conversationId, userId]
  );
  
  return result.rows.length > 0;
}

export default {
  createMessage,
  getConversationMessages,
  updateMessageStatus,
  deleteMessage,
  createConversation,
  getUserConversations,
  getConversationDetails,
  createCall,
  updateCallStatus,
  getCallDetails,
  updateUserPresence,
  getUserPresence,
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  getMediaPermissions,
  updateMediaPermission,
  getCallPermissionsForRole,
  logCommunicationAudit,
  updateTypingIndicator,
  getTypingUsers,
  addConversationParticipant,
  removeConversationParticipant,
  isParticipant,
};
