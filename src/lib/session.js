/**
 * Session Management Utilities
 * Handles server-side session creation, validation, cleanup, and device tracking.
 *
 * Security features:
 *  - Sessions stored server-side only (HTTP-only cookie carries only session ID)
 *  - Device / IP / user-agent recorded per session (multi-device visibility)
 *  - Inactivity timeout enforced (default 60 min; absolute expiry 24 h)
 *  - Sessions can be individually revoked (is_revoked flag)
 *  - No JWT anywhere in this system
 */

import { randomUUID } from 'crypto';
import { query } from './db.js';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days absolute max
const INACTIVITY_TIMEOUT_MIN = 60;                        // 60-minute idle timeout

/**
 * Create a new session for a user.
 *
 * @param {string} userId
 * @param {{ deviceName?: string, ipAddress?: string, userAgent?: string }} [deviceInfo]
 * @returns {Promise<string>} Session ID
 */
export async function createSession(userId, deviceInfo = {}) {
  try {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    const { deviceName, ipAddress, userAgent, browser, os } = deviceInfo;

    await query(
      `INSERT INTO sessions (id, user_id, expires_at, created_at, last_activity,
                             device_name, ip_address, user_agent, browser, os,
                             inactivity_timeout_minutes, is_revoked)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8, $9, false)`,
      [sessionId, userId, expiresAt, deviceName ?? null, ipAddress ?? null,
       userAgent ?? null, browser ?? null, os ?? null, INACTIVITY_TIMEOUT_MIN]
    );

    return sessionId;
  } catch (error) {
    console.error('Error creating session:', error.message);
    throw error;
  }
}

/**
 * Get session data from session ID.
 * Validates: not expired, not revoked, inactivity timeout not exceeded.
 *
 * @param {string} sessionId
 * @returns {Promise<Object|null>}
 */
export async function getSession(sessionId) {
  try {
    const result = await query(
      `SELECT 
        s.id, 
        s.user_id, 
        s.expires_at, 
        s.created_at,
        s.last_activity,
        s.inactivity_timeout_minutes,
        s.is_revoked,
        s.device_name,
        s.ip_address,
        u.id AS u_id,
        u.email,
        u.role,
        u.status
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1
         AND s.expires_at > CURRENT_TIMESTAMP
         AND s.is_revoked = false`,
      [sessionId]
    );

    if (!result.rows[0]) {
      return null;
    }

    const row = result.rows[0];

    // Enforce inactivity timeout
    const idleMinutes = (Date.now() - new Date(row.last_activity).getTime()) / 60000;
    const timeoutMin = row.inactivity_timeout_minutes ?? INACTIVITY_TIMEOUT_MIN;
    if (idleMinutes > timeoutMin) {
      // Revoke timed-out session
      await query(`UPDATE sessions SET is_revoked = true WHERE id = $1`, [sessionId]);
      return null;
    }

    // Update last activity in the background
    updateSessionActivity(sessionId).catch(() => {});

    return {
      id: row.id,
      userId: row.user_id,
      expiresAt: row.expires_at,
      deviceName: row.device_name,
      ipAddress: row.ip_address,
      user: {
        id: row.user_id,
        email: row.email,
        role: row.role,
        status: row.status,
      },
    };
  } catch (error) {
    // If the DB is unreachable (Neon cold-paused, network blip), let the
    // typed error propagate so the caller can return 503 instead of 401.
    // Only swallow genuine "no session" cases as null.
    if (error?.name === 'DatabaseUnavailableError') {
      throw error;
    }
    console.error('Error getting session:', error.message);
    return null;
  }
}

/**
 * Update session last activity timestamp
 * @param {string} sessionId - Session ID
 * @returns {Promise<void>}
 */
export async function updateSessionActivity(sessionId) {
  try {
    const sessionResult = await query(
      `UPDATE sessions 
       SET last_activity = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING user_id`,
      [sessionId]
    );

    // Also update user's last_seen timestamp
    if (sessionResult.rows[0]?.user_id) {
      await updateUserLastSeen(sessionResult.rows[0].user_id);
    }
  } catch (error) {
    console.error('Error updating session activity:', error.message);
  }
}

/**
 * Update user's last_seen timestamp and online status
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function updateUserLastSeen(userId) {
  try {
    await query(
      `UPDATE users
       SET last_seen    = CURRENT_TIMESTAMP,
           last_seen_at = CURRENT_TIMESTAMP,
           is_online    = true
       WHERE id = $1`,
      [userId]
    );
    // Also keep user_presence table in sync
    await query(
      `INSERT INTO user_presence (user_id, last_ping, last_seen, status, is_online, updated_at)
       VALUES ($1, NOW(), NOW(), 'online', true, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET last_ping  = NOW(),
           last_seen  = NOW(),
           updated_at = NOW()`,
      [userId]
    );
  } catch (error) {
    if (error.code === '42703') {
      // Column does not exist error - migration not run yet
      return;
    }
    console.error('Error updating user last_seen:', error.message);
  }
}

/**
 * Delete (hard-delete) a session — used on logout
 * @param {string} sessionId
 */
export async function deleteSession(sessionId) {
  try {
    await query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
  } catch (error) {
    console.error('Error deleting session:', error.message);
    throw error;
  }
}

/**
 * Delete all sessions for a user (logout all devices)
 * @param {string} userId
 */
export async function deleteAllUserSessions(userId) {
  try {
    await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
  } catch (error) {
    console.error('Error deleting all user sessions:', error.message);
    throw error;
  }
}

/**
 * Clean up expired sessions from database (maintenance)
 * @returns {Promise<number>} Number of deleted sessions
 */
export async function cleanupExpiredSessions() {
  try {
    const result = await query(
      `DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP`
    );
    return result.rowCount || 0;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error.message);
    return 0;
  }
}

/**
 * Get secure cookie options for HTTP-only session cookie
 * @returns {Object} Cookie options for Next.js response
 */
export function getSecureCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    httpOnly: true,            // Not accessible via JavaScript
    secure: isProduction,      // HTTPS only in production
    // 'lax' sends cookie on same-site navigations AND top-level cross-site navigations
    // (e.g. GET links, redirects). 'strict' would block the cookie during redirect
    // chains on Vercel/Firefox, causing infinite redirect loops.
    sameSite: 'lax',
    maxAge: SESSION_DURATION_MS / 1000, // Convert ms to seconds
    path: '/',
  };
}

/**
 * Get all active sessions for a user (multi-device management)
 *
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getUserSessions(userId) {
  try {
    const result = await query(
      `SELECT id, device_name, browser, os, ip_address, created_at, last_activity, expires_at
       FROM sessions
       WHERE user_id = $1
         AND expires_at > CURRENT_TIMESTAMP
         AND is_revoked = false
       ORDER BY last_activity DESC`,
      [userId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching user sessions:', error.message);
    return [];
  }
}

/**
 * Revoke a specific session (used for "log out this device" feature)
 *
 * @param {string} sessionId
 * @param {string} [requestingUserId] - If set, verifies the session belongs to this user
 * @returns {Promise<boolean>}
 */
export async function revokeSession(sessionId, requestingUserId = null) {
  try {
    let sql = `UPDATE sessions SET is_revoked = true WHERE id = $1`;
    const params = [sessionId];
    if (requestingUserId) {
      sql += ` AND user_id = $2`;
      params.push(requestingUserId);
    }
    const result = await query(sql, params);
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Error revoking session:', error.message);
    return false;
  }
}

/**
 * Revoke all sessions for a user except optionally the current one.
 * Call this on password change or role change.
 *
 * @param {string} userId
 * @param {string} [exceptSessionId] - Don't revoke this session (current session)
 * @returns {Promise<number>} Number of revoked sessions
 */
export async function revokeAllUserSessionsExcept(userId, exceptSessionId = null) {
  try {
    let sql = `UPDATE sessions SET is_revoked = true WHERE user_id = $1 AND is_revoked = false`;
    const params = [userId];
    if (exceptSessionId) {
      sql += ` AND id != $2`;
      params.push(exceptSessionId);
    }
    const result = await query(sql, params);
    return result.rowCount ?? 0;
  } catch (error) {
    console.error('Error revoking all user sessions:', error.message);
    return 0;
  }
}

/**
 * Extract session ID from cookie header
 * @param {Object} cookies - Cookies object from request
 * @returns {string|null} Session ID or null if not found
 */
export function getSessionFromCookies(cookies) {
  if (!cookies) return null;
  return cookies.get('consty_session')?.value || null;
}

export default {
  createSession,
  getSession,
  updateSessionActivity,
  deleteSession,
  deleteAllUserSessions,
  cleanupExpiredSessions,
  getSecureCookieOptions,
  getSessionFromCookies,
};
