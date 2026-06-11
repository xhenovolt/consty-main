/**
 * Get Current User
 * Server-side utility to fetch authenticated user from session
 * Use this in Server Components, layouts, and API routes
 */

import { cookies } from 'next/headers.js';
import { getSession, getSessionFromCookies } from './session.js';
import { findUserById } from './auth.js';

/**
 * Get the current authenticated user
 * Call this in Server Components or API routes
 * @returns {Promise<Object|null>} User object or null if not authenticated
 */
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    
    // Get session ID from cookie
    const sessionId = cookieStore.get('consty_session')?.value;
    
    if (!sessionId) {
      return null;
    }

    // Validate session and get user
    const session = await getSession(sessionId);
    
    if (!session) {
      return null;
    }

    // Fetch full user object from database
    const user = await findUserById(session.userId);
    
    if (!user) {
      return null;
    }

    // Return user object without sensitive fields
    // NOTE: users table has no is_superadmin column — derive from role field
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      fullName: user.full_name,
      isSuperadmin: user.role === 'superadmin',
      is_superadmin: user.role === 'superadmin',
      createdAt: user.created_at,
    };
  } catch (error) {
    console.error('Error getting current user:', error.message);
    return null;
  }
}

/**
 * Get current user or throw error
 * Use this when user MUST be authenticated
 * @returns {Promise<Object>} User object
 * @throws {Error} If user is not authenticated
 */
export async function getCurrentUserOrThrow() {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Unauthorized: No authenticated user found');
  }
  
  return user;
}

/**
 * Check if current user has a specific role
 * @param {string|string[]} requiredRole - Role(s) to check
 * @returns {Promise<boolean>} True if user has required role
 */
export async function hasRole(requiredRole) {
  const user = await getCurrentUser();
  
  if (!user) {
    return false;
  }

  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(user.role);
  }

  return user.role === requiredRole;
}

/**
 * Check if current user is authenticated
 * @returns {Promise<boolean>} True if user is authenticated
 */
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}

export default {
  getCurrentUser,
  getCurrentUserOrThrow,
  hasRole,
  isAuthenticated,
};
