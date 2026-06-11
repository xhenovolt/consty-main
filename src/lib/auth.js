/**
 * Authentication Utilities
 * Password hashing, user lookup, and user creation
 */

import bcrypt from 'bcryptjs';
import { query } from './db.js';

const SALT_ROUNDS = 10;

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Password hash
 * @returns {Promise<boolean>} True if password matches
 */
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Find user by email
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User object or null
 */
export async function findUserByEmail(email) {
  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding user by email:', error.message);
    return null;
  }
}

/**
 * Find user by ID
 * @param {string} userId - User ID (UUID)
 * @returns {Promise<Object|null>} User object or null
 */
export async function findUserById(userId) {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding user by ID:', error.message);
    return null;
  }
}

/**
 * Create a new user
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.passwordHash - Hashed password
 * @param {string} userData.name - Full name
 * @param {string} [userData.username] - Username (auto-derived from email if omitted)
 * @param {string} [userData.role] - User role (default: 'user')
 * @param {boolean} [userData.isActive] - Whether user is active
 * @param {string} [userData.status] - User status (active/pending)
 * @param {string|null} [userData.staffId] - Linked staff record ID
 * @param {boolean} [userData.mustResetPassword] - Force password change on first login
 * @returns {Promise<Object|null>} Created user or null on error
 */
export async function createUser({
  email,
  passwordHash,
  name,
  username,
  role = 'user',
  isActive = true,
  status = 'active',
  staffId = null,
  mustResetPassword = false,
}) {
  // Derive username from email if not supplied
  const resolvedUsername =
    username ||
    email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 100);

  try {
    const result = await query(
      `INSERT INTO users (email, password_hash, name, username, role, is_active, status, staff_id, must_reset_password, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, email, name, username, role, is_active, status, staff_id, must_reset_password, created_at`,
      [email, passwordHash, name, resolvedUsername, role, isActive, status, staffId, mustResetPassword]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error creating user:', error.message);
    if (error.code === '23505') {
      // Unique violation — figure out which field
      if (error.detail?.includes('username')) return { error: 'Username already taken' };
      return { error: 'Email already exists' };
    }
    return null;
  }
}

/**
 * Count total users in the system
 * Used for superadmin bootstrap (first user = superadmin)
 * @returns {Promise<number>} User count
 */
export async function getUserCount() {
  try {
    const result = await query('SELECT COUNT(*)::int AS count FROM users');
    return result.rows[0]?.count || 0;
  } catch (error) {
    console.error('Error counting users:', error.message);
    return 0;
  }
}

/**
 * Update user's last login timestamp
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if successful
 */
export async function updateUserLastLogin(userId) {
  try {
    const result = await query(
      'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [userId]
    );
    return !!result.rows[0];
  } catch (error) {
    console.error('Error updating last login:', error.message);
    return false;
  }
}

/**
 * Verify user credentials (email and password)
 * @param {string} email - User email
 * @param {string} password - Plain text password
 * @returns {Promise<Object|null>} User object, error object, or null if invalid
 */
export async function verifyCredentials(email, password) {
  try {
    const user = await findUserByEmail(email);

    if (!user) {
      return null;
    }

    if (!user.is_active) {
      return { error: 'ACCOUNT_DISABLED', message: 'Your account has been disabled. Contact an administrator.' };
    }

    // Check status-based activation
    if (user.status === 'pending') {
      return { error: 'ACCOUNT_PENDING', message: 'Your account is pending activation. Please wait for admin approval.' };
    }

    if (user.status === 'suspended') {
      return { error: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended. Contact an administrator.' };
    }

    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      return null;
    }

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    console.error('Error verifying credentials:', error.message);
    return null;
  }
}

export default {
  hashPassword,
  comparePassword,
  findUserByEmail,
  findUserById,
  createUser,
  getUserCount,
  updateUserLastLogin,
  verifyCredentials,
};
