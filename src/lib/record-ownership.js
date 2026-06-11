import { query } from '@/lib/db.js';

/**
 * Record Ownership Utilities
 * Stamp ownership on create/modify for any entity
 */

/**
 * Get ownership fields for INSERT (creation)
 * @param {string} userId - The creating user's ID
 * @returns {{ columns: string[], values: any[], placeholderOffset: number => string[] }}
 */
export function getOwnershipStamp(userId) {
  return {
    columns: ['created_by_user_id', 'last_modified_by_user_id', 'last_modified_at'],
    values: [userId, userId, new Date()],
  };
}

/**
 * Get modification fields for UPDATE
 * @param {string} userId - The modifying user's ID
 * @returns {string} SQL SET fragment
 */
export function getModificationStamp(userId) {
  return {
    setClause: 'last_modified_by_user_id = $__IDX__, last_modified_at = NOW()',
    values: [userId],
  };
}

/**
 * Build INSERT with ownership fields appended
 * @param {string} table - Table name
 * @param {object} fields - { column: value } map
 * @param {string} userId - Creating user ID
 * @param {string} [returning] - RETURNING clause (default: '*')
 */
export async function insertWithOwnership(table, fields, userId, returning = '*') {
  const ownership = getOwnershipStamp(userId);
  const allColumns = [...Object.keys(fields), ...ownership.columns];
  const allValues = [...Object.values(fields), ...ownership.values];
  const placeholders = allValues.map((_, i) => `$${i + 1}`);

  const sql = `INSERT INTO "${table}" (${allColumns.map(c => `"${c}"`).join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING ${returning}`;

  return query(sql, allValues);
}

/**
 * Build UPDATE with modification stamp appended
 * @param {string} table - Table name
 * @param {string} id - Record ID
 * @param {object} fields - { column: value } map
 * @param {string} userId - Modifying user ID
 * @param {string} [returning] - RETURNING clause
 */
export async function updateWithOwnership(table, id, fields, userId, returning = '*') {
  const entries = Object.entries(fields);
  const setClauses = entries.map(([col], i) => `"${col}" = $${i + 1}`);
  const values = entries.map(([, val]) => val);

  // Append modification stamp
  const modIdx = values.length + 1;
  setClauses.push(`last_modified_by_user_id = $${modIdx}`);
  setClauses.push(`last_modified_at = NOW()`);
  values.push(userId);

  // ID is last param
  const idIdx = values.length + 1;
  values.push(id);

  const sql = `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE id = $${idIdx} RETURNING ${returning}`;
  return query(sql, values);
}

/**
 * Check if a user owns or has authority over a record
 * @param {string} table - Table name
 * @param {string} recordId - Record ID
 * @param {string} userId - User ID to check
 * @param {number} userHierarchyLevel - User's hierarchy level
 * @returns {Promise<{ isOwner: boolean, canModify: boolean }>}
 */
export async function checkRecordOwnership(table, recordId, userId, userHierarchyLevel) {
  const result = await query(
    `SELECT created_by_user_id FROM "${table}" WHERE id = $1`,
    [recordId]
  );

  if (!result.rows[0]) return { isOwner: false, canModify: false };

  const isOwner = result.rows[0].created_by_user_id === userId;
  // Hierarchy level 1 = founder, 2 = superadmin, 3 = admin — lower number = more authority
  const canModify = isOwner || userHierarchyLevel <= 3;

  return { isOwner, canModify };
}
