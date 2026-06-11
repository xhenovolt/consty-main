/**
 * Universal RBAC middleware for API routes
 * Usage: await requirePermission(request, 'module.action')
 * Returns NextResponse with 403 if forbidden, or { userId, authorityLevel, permissions } if allowed
 */
// (removed duplicate requirePermission definition)
/**
 * Enterprise RBAC Permission System
 * Database-backed role-based access control with:
 *  - Permission caching (in-memory, per-user, TTL-based)
 *  - Hierarchical authority enforcement
 *  - Approval workflow integration
 *  - Comprehensive audit logging
 *
 * Superadmin bypasses ALL permission checks.
 * All other users checked against role_permissions table.
 */

import { query } from './db.js';
import { verifyAuth } from './auth-utils.js';
import { NextResponse } from 'next/server';

// ============================================================================
// PERMISSION CACHE (in-memory, per-process)
// ============================================================================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** @type {Map<string, { permissions: string[], hierarchyLevel: number, authorityLevel: number, dataScope: string, departmentId: string|null, expiry: number }>} */
const permissionCache = new Map();

/**
 * Get cached permissions for a user, or load from DB and cache
 */
async function getCachedPermissions(userId) {
  const cached = permissionCache.get(userId);
  if (cached && cached.expiry > Date.now()) {
    return cached;
  }
  // Load from DB
  const [permissions, hierarchyLevel, authorityLevel, dataScope, departmentId] = await Promise.all([
    loadUserPermissionsFromDB(userId),
    getUserHierarchyLevel(userId),
    getUserAuthorityLevel(userId),
    getUserDataScope(userId),
    getUserDepartmentId(userId),
  ]);
  const entry = { permissions, hierarchyLevel, authorityLevel, dataScope, departmentId, expiry: Date.now() + CACHE_TTL_MS };
  permissionCache.set(userId, entry);
  return entry;
}

/**
 * Invalidate cache for a specific user (call after role/permission changes)
 */
export function invalidatePermissionCache(userId) {
  if (userId) {
    permissionCache.delete(userId);
  }
}

/**
 * Invalidate all cached permissions (call after bulk changes)
 */
export function invalidateAllPermissionCaches() {
  permissionCache.clear();
}

// ============================================================================
// DATABASE-BACKED PERMISSION CHECKS
// ============================================================================

/**
 * Load all permissions for a user from DB (internal, used by cache).
 *
 * Primary path:  users → staff → staff_roles → role_permissions → permissions
 * Fallback path: users.role (text) → roles → role_permissions → permissions
 *   (used when the user has no linked staff record yet, e.g. orphan users)
 */
async function loadUserPermissionsFromDB(userId) {
  try {
    // Primary: full normalized chain
    const result = await query(
      `SELECT DISTINCT p.module, p.action
       FROM users u
       JOIN staff s ON u.staff_id = s.id
       JOIN staff_roles sr ON sr.staff_id = s.id
       JOIN role_permissions rp ON sr.role_id = rp.role_id
       JOIN permissions p ON rp.permission_id = p.id
       WHERE u.id = $1
       ORDER BY p.module, p.action`,
      [userId]
    );
    if (result.rows.length > 0) {
      return result.rows.map(r => `${r.module}.${r.action}`);
    }

    // Fallback: derive from users.role text field when staff link is missing
    const fallback = await query(
      `SELECT DISTINCT p.module, p.action
       FROM users u
       JOIN roles r ON u.role = r.name
       JOIN role_permissions rp ON rp.role_id = r.id
       JOIN permissions p ON rp.permission_id = p.id
       WHERE u.id = $1
       ORDER BY p.module, p.action`,
      [userId]
    );
    return fallback.rows.map(r => `${r.module}.${r.action}`);
  } catch (error) {
    console.error('[RBAC] loadUserPermissionsFromDB failed:', error.message);
    return [];
  }
}

/**
 * Check if user has a specific permission via cached RBAC
 * @param {string} userId - User UUID
 * @param {string} module - Module name (e.g., 'finance')
 * @param {string} action - Action name (e.g., 'view')
 * @param {string} userRole - User's role from session
 * @returns {Promise<boolean>}
 */
export async function hasPermission(userId, module, action, userRole) {
  if (userRole === 'superadmin') return true;
  try {
    const { permissions } = await getCachedPermissions(userId);
    return permissions.includes(`${module}.${action}`);
  } catch (error) {
    console.error('[RBAC] hasPermission failed:', error.message);
    return false;
  }
}

/**
 * Get all permissions for a user (cached)
 */
export async function getUserPermissions(userId) {
  try {
    const { permissions } = await getCachedPermissions(userId);
    return permissions;
  } catch (error) {
    console.error('[RBAC] getUserPermissions failed:', error.message);
    return [];
  }
}

/**
 * Get all permissions for a role from DB
 */
export async function getRolePermissionsFromDB(roleId) {
  try {
    const result = await query(
      `SELECT p.id, p.module, p.action, p.description
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = $1
       ORDER BY p.module, p.action`,
      [roleId]
    );
    return result.rows;
  } catch (error) {
    console.error('[RBAC] getRolePermissionsFromDB failed:', error.message);
    return [];
  }
}

// ============================================================================
// DATA SCOPE
// ============================================================================

/**
 * Get the data scope for a user based on their most-permissive role.
 * GLOBAL > DEPARTMENT > OWN  (returns highest privilege found)
 * Defaults to OWN when no role is linked.
 *
 * @param {string} userId
 * @returns {Promise<'OWN'|'DEPARTMENT'|'GLOBAL'>}
 */
export async function getUserDataScope(userId) {
  try {
    const result = await query(
      `SELECT r.data_scope
       FROM users u
       JOIN staff s ON u.staff_id = s.id
       JOIN staff_roles sr ON sr.staff_id = s.id
       JOIN roles r ON sr.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    );
    if (result.rows.length > 0) {
      const scopes = result.rows.map(r => r.data_scope).filter(Boolean);
      if (scopes.includes('GLOBAL'))     return 'GLOBAL';
      if (scopes.includes('DEPARTMENT')) return 'DEPARTMENT';
      if (scopes.includes('OWN'))        return 'OWN';
    }
    // Fallback: via users.role text
    const fallback = await query(
      `SELECT r.data_scope
       FROM users u
       JOIN roles r ON u.role = r.name
       WHERE u.id = $1`,
      [userId]
    );
    if (fallback.rows.length > 0) {
      const scopes = fallback.rows.map(r => r.data_scope).filter(Boolean);
      if (scopes.includes('GLOBAL'))     return 'GLOBAL';
      if (scopes.includes('DEPARTMENT')) return 'DEPARTMENT';
      if (scopes.includes('OWN'))        return 'OWN';
    }
    return 'OWN'; // Safest default
  } catch (error) {
    console.error('[RBAC] getUserDataScope failed:', error.message);
    return 'OWN'; // Fail closed
  }
}

/**
 * Get the department_id for a user via their staff record.
 *
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
export async function getUserDepartmentId(userId) {
  try {
    const result = await query(
      `SELECT s.department_id FROM users u JOIN staff s ON u.staff_id = s.id WHERE u.id = $1`,
      [userId]
    );
    return result.rows[0]?.department_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Build a SQL WHERE clause fragment to enforce data scope.
 *
 * Usage:
 *   const existing = [stage]; // already bound params
 *   const filter = buildDataScopeFilter({ dataScope, userId, departmentId,
 *                                         tableAlias: 'p', paramOffset: existing.length });
 *   const params = [...existing, ...filter.params];
 *   query(`SELECT * FROM prospects p WHERE p.stage = $1${filter.clause}`, params);
 *
 * @param {{ dataScope: string, userId: string, departmentId: string|null,
 *           tableAlias?: string, createdByCol?: string, departmentCol?: string,
 *           paramOffset?: number }} opts
 * @returns {{ clause: string, params: any[] }}
 */
export function buildDataScopeFilter({
  dataScope,
  userId,
  departmentId,
  tableAlias = '',
  createdByCol = 'created_by',
  departmentCol = 'department_id',
  paramOffset = 0,
}) {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  if (dataScope === 'GLOBAL') {
    return { clause: '', params: [] };
  }
  if (dataScope === 'DEPARTMENT' && departmentId) {
    return {
      clause: ` AND (${prefix}${departmentCol} = $${paramOffset + 1} OR ${prefix}${createdByCol} = $${paramOffset + 2})`,
      params: [departmentId, userId],
    };
  }
  // OWN (or DEPARTMENT without a department)
  return {
    clause: ` AND ${prefix}${createdByCol} = $${paramOffset + 1}`,
    params: [userId],
  };
}

/**
 * Get data scope info for user from cache (single convenient call for API routes).
 *
 * @param {string} userId
 * @returns {Promise<{ dataScope: string, departmentId: string|null }>}
 */
export async function getUserScopeInfo(userId) {
  try {
    const cached = await getCachedPermissions(userId);
    return { dataScope: cached.dataScope ?? 'OWN', departmentId: cached.departmentId ?? null };
  } catch {
    return { dataScope: 'OWN', departmentId: null };
  }
}

// ============================================================================
// HIERARCHY SYSTEM
// ============================================================================

/**
 * Get the effective hierarchy level for a user (lowest number = highest authority).
 * Primary: via staff → staff_roles → roles chain.
 * Fallback: via users.role → roles (when no staff record is linked).
 */
export async function getUserHierarchyLevel(userId) {
  try {
    const result = await query(
      `SELECT MIN(r.hierarchy_level) AS hierarchy_level
       FROM users u
       JOIN staff s ON u.staff_id = s.id
       JOIN staff_roles sr ON sr.staff_id = s.id
       JOIN roles r ON sr.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    );
    if (result.rows[0]?.hierarchy_level != null) {
      return result.rows[0].hierarchy_level;
    }
    // Fallback: use users.role text
    const fallback = await query(
      `SELECT MIN(r.hierarchy_level) AS hierarchy_level
       FROM users u JOIN roles r ON u.role = r.name
       WHERE u.id = $1`,
      [userId]
    );
    return fallback.rows[0]?.hierarchy_level ?? 5;
  } catch (error) {
    console.error('[RBAC] getUserHierarchyLevel failed:', error.message);
    return 5;
  }
}

/**
 * Get the effective authority level for a user (higher number = more authority).
 * Primary: via staff → staff_roles → roles chain.
 * Fallback A: use denormalized users.authority_level (fast path).
 * Fallback B: derive from users.role text → roles.
 */
export async function getUserAuthorityLevel(userId) {
  try {
    const result = await query(
      `SELECT MAX(r.authority_level) AS authority_level
       FROM users u
       JOIN staff s ON u.staff_id = s.id
       JOIN staff_roles sr ON sr.staff_id = s.id
       JOIN roles r ON sr.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    );
    if (result.rows[0]?.authority_level != null) {
      return result.rows[0].authority_level;
    }
    // Fallback A: denormalized column
    const fast = await query(
      `SELECT authority_level FROM users WHERE id = $1`,
      [userId]
    );
    if (fast.rows[0]?.authority_level != null && fast.rows[0].authority_level > 10) {
      return fast.rows[0].authority_level;
    }
    // Fallback B: derive from users.role text
    const fallback = await query(
      `SELECT MAX(r.authority_level) AS authority_level
       FROM users u JOIN roles r ON u.role = r.name
       WHERE u.id = $1`,
      [userId]
    );
    return fallback.rows[0]?.authority_level ?? 10;
  } catch (error) {
    console.error('[RBAC] getUserAuthorityLevel failed:', error.message);
    return 10;
  }
}

/**
 * Check if a user has sufficient authority to act on a record created by another user
 * Returns { allowed: true } or { allowed: false, requiresApproval: true }
 *
 * @param {string} actingUserId - The user trying to perform the action
 * @param {string} recordCreatorId - The user who created the target record
 * @param {string} action - The action being attempted (delete, update)
 */
export async function checkHierarchyAuthority(actingUserId, recordCreatorId, action) {
  // Same user can always modify their own records
  if (actingUserId === recordCreatorId) {
    return { allowed: true };
  }

  try {
    const [actingCache, creatorLevel] = await Promise.all([
      getCachedPermissions(actingUserId),
      getUserHierarchyLevel(recordCreatorId),
    ]);

    const actingLevel = actingCache.hierarchyLevel;

    // Lower number = higher authority
    if (actingLevel <= creatorLevel) {
      return { allowed: true };
    }

    // Restricted actions that require approval when acting on higher-authority records
    const restrictedActions = ['delete', 'update'];
    if (restrictedActions.includes(action)) {
      return { allowed: false, requiresApproval: true };
    }

    return { allowed: true };
  } catch (error) {
    console.error('[RBAC] checkHierarchyAuthority failed:', error.message);
    return { allowed: false, requiresApproval: true };
  }
}

// ============================================================================
// APPROVAL WORKFLOW
// ============================================================================

/**
 * Create an approval request when a user attempts a restricted action
 */
export async function createApprovalRequest({
  requesterUserId,
  targetRecordType,
  targetRecordId,
  actionRequested,
  reason = null,
}) {
  try {
    const result = await query(
      `INSERT INTO approval_requests (requester_user_id, target_record_type, target_record_id, action_requested, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, status, created_at`,
      [requesterUserId, targetRecordType, targetRecordId, actionRequested, reason]
    );
    return result.rows[0];
  } catch (error) {
    console.error('[RBAC] createApprovalRequest failed:', error.message);
    return null;
  }
}

/**
 * Resolve an approval request (approve or reject)
 */
export async function resolveApprovalRequest(requestId, approverUserId, status, notes = null) {
  try {
    const result = await query(
      `UPDATE approval_requests
       SET status = $1, approver_user_id = $2, approver_notes = $3, resolved_at = NOW()
       WHERE id = $4 AND status = 'pending'
       RETURNING *`,
      [status, approverUserId, notes, requestId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('[RBAC] resolveApprovalRequest failed:', error.message);
    return null;
  }
}

/**
 * Get pending approval requests for users with equal or lower hierarchy level
 */
export async function getPendingApprovalsForUser(userId) {
  try {
    const hierarchyLevel = await getUserHierarchyLevel(userId);
    const result = await query(
      `SELECT ar.*, 
              u.name AS requester_name, u.email AS requester_email
       FROM approval_requests ar
       JOIN users u ON ar.requester_user_id = u.id
       WHERE ar.status = 'pending'
         AND (
           -- User can approve if they have higher authority than requester
           $1 <= (
             SELECT COALESCE(MIN(r.hierarchy_level), 5)
             FROM users u2
             JOIN staff s2 ON u2.staff_id = s2.id
             JOIN staff_roles sr2 ON sr2.staff_id = s2.id
             JOIN roles r ON sr2.role_id = r.id
             WHERE u2.id = ar.requester_user_id
           )
         )
       ORDER BY ar.created_at DESC`,
      [hierarchyLevel]
    );
    return result.rows;
  } catch (error) {
    console.error('[RBAC] getPendingApprovalsForUser failed:', error.message);
    return [];
  }
}

// ============================================================================
// MIDDLEWARE: require specific permission on API route
// ============================================================================

/**
 * Require specific permission on an API route.
 *
 * Supports two calling conventions:
 *   requirePermission(request, 'staff.view')          // 2-arg dot-notation
 *   requirePermission(request, 'staff', 'view')       // 3-arg explicit
 *
 * Returns { auth } if allowed, or a NextResponse error if denied.
 */
export async function requirePermission(request, moduleOrPermission, action) {
  // Normalise calling convention: 'module.action' string → module + action parts
  let module, act;
  if (action === undefined && typeof moduleOrPermission === 'string' && moduleOrPermission.includes('.')) {
    const dotIdx = moduleOrPermission.indexOf('.');
    module = moduleOrPermission.slice(0, dotIdx);
    act = moduleOrPermission.slice(dotIdx + 1);
  } else {
    module = moduleOrPermission;
    act = action;
  }

  // verifyAuth re-throws DatabaseUnavailableError so we can convert it to
  // a clean 503 here instead of leaking it as 500 / 401.
  let auth;
  try {
    auth = await verifyAuth(request);
  } catch (err) {
    if (err?.name === 'DatabaseUnavailableError') {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.', code: 'DB_UNAVAILABLE' },
        { status: 503, headers: { 'Retry-After': '3' } }
      );
    }
    throw err;
  }
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (auth.status === 'pending') {
    return NextResponse.json(
      { error: 'Your account is awaiting activation by an administrator.' },
      { status: 403 }
    );
  }
  if (auth.status === 'suspended') {
    return NextResponse.json(
      { error: 'Your account has been suspended. Contact an administrator.' },
      { status: 403 }
    );
  }
  // Superadmin bypasses all permission checks
  if (auth.role === 'superadmin') {
    return { auth, dataScope: 'GLOBAL', departmentId: null };
  }

  const [allowed, scopeInfo] = await Promise.all([
    hasPermission(auth.userId, module, act, auth.role),
    getUserScopeInfo(auth.userId),
  ]);
  if (!allowed) {
    return NextResponse.json(
      { error: `Access denied. Required permission: ${module}.${act}` },
      { status: 403 }
    );
  }
  return { auth, dataScope: scopeInfo.dataScope, departmentId: scopeInfo.departmentId };
}

/**
 * Require permission AND hierarchy check for modifying records
 * Use this for update/delete on records that have a created_by field
 *
 * Returns: { auth } on success, NextResponse on error, or { auth, approvalRequired, approvalRequest } if approval needed
 */
export async function requirePermissionWithHierarchy(request, module, action, recordCreatorId) {
  // First check basic permission
  const result = await requirePermission(request, module, action);
  if (result instanceof NextResponse) return result;

  const { auth } = result;

  // If no creator ID, skip hierarchy check
  if (!recordCreatorId) return { auth };

  // Superadmin bypasses hierarchy
  if (auth.role === 'superadmin') return { auth };

  // Check hierarchy authority
  const hierarchyResult = await checkHierarchyAuthority(auth.userId, recordCreatorId, action);

  if (hierarchyResult.allowed) {
    return { auth };
  }

  if (hierarchyResult.requiresApproval) {
    return {
      auth,
      approvalRequired: true,
    };
  }

  return NextResponse.json(
    { error: 'Insufficient authority to perform this action.' },
    { status: 403 }
  );
}

// ============================================================================
// ROLE MANAGEMENT
// ============================================================================

/**
 * Assign a role to a user
 */
export async function assignRole(userId, roleName, assignedBy = null) {
  try {
    const roleResult = await query('SELECT id FROM roles WHERE name = $1', [roleName]);
    if (!roleResult.rows[0]) throw new Error(`Role '${roleName}' not found`);
    const staffResult = await query('SELECT staff_id FROM users WHERE id = $1', [userId]);
    const staffId = staffResult.rows[0]?.staff_id;
    if (!staffId) throw new Error(`User has no linked staff record`);
    await query(
      `INSERT INTO staff_roles (staff_id, role_id, assigned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (staff_id, role_id) DO NOTHING`,
      [staffId, roleResult.rows[0].id, assignedBy]
    );
    invalidatePermissionCache(userId);
    return true;
  } catch (error) {
    console.error('[RBAC] assignRole failed:', error.message);
    return false;
  }
}

/**
 * Remove a role from a user
 */
export async function removeRole(userId, roleName) {
  try {
    const roleResult = await query('SELECT id FROM roles WHERE name = $1', [roleName]);
    if (!roleResult.rows[0]) return false;
    const staffResult = await query('SELECT staff_id FROM users WHERE id = $1', [userId]);
    const staffId = staffResult.rows[0]?.staff_id;
    if (!staffId) return false;
    await query(
      'DELETE FROM staff_roles WHERE staff_id = $1 AND role_id = $2',
      [staffId, roleResult.rows[0].id]
    );
    invalidatePermissionCache(userId);
    return true;
  } catch (error) {
    console.error('[RBAC] removeRole failed:', error.message);
    return false;
  }
}

/**
 * Get all available permissions grouped by module
 */
export async function getAllPermissionsGrouped() {
  try {
    const result = await query(
      'SELECT id, module, action, description, route_path FROM permissions ORDER BY module, action'
    );
    const grouped = {};
    for (const perm of result.rows) {
      if (!grouped[perm.module]) grouped[perm.module] = [];
      grouped[perm.module].push(perm);
    }
    return { flat: result.rows, grouped };
  } catch (error) {
    console.error('[RBAC] getAllPermissionsGrouped failed:', error.message);
    return { flat: [], grouped: {} };
  }
}

// ============================================================================
// LEGACY COMPATIBILITY LAYER (static permission matrix)
// Kept for backward compatibility with existing code
// ============================================================================

const PERMISSION_MATRIX = {
  FOUNDER: {
    assets: ['create', 'read', 'update', 'delete', 'restore', 'lock', 'unlock', 'export'],
    liabilities: ['create', 'read', 'update', 'delete', 'restore', 'lock', 'unlock', 'export'],
    deals: ['create', 'read', 'update', 'delete', 'restore', 'lock', 'unlock', 'export'],
    shares: ['create', 'read', 'update', 'delete', 'issue', 'transfer', 'revoke'],
    reports: ['read', 'create', 'export', 'schedule'],
    staff: ['create', 'read', 'update', 'suspend', 'reactivate', 'delete', 'assign_role'],
    audit_logs: ['read', 'export'],
    settings: ['read', 'update', 'manage_integrations'],
    permissions: ['read', 'update'],
  },
  ADMIN: {
    // Administrator with wide access (except financial and staff management)
    assets: ['create', 'read', 'update', 'restore', 'export'],
    liabilities: ['create', 'read', 'update', 'restore', 'export'],
    deals: ['create', 'read', 'update', 'restore', 'export'],
    shares: ['read'],
    reports: ['read', 'create', 'export', 'schedule'],
    staff: ['create', 'read', 'update', 'suspend', 'reactivate'],
    audit_logs: ['read', 'export'],
    settings: ['read'],
    permissions: ['read'],
  },
  FINANCE: {
    // Finance manager with access to financial records
    assets: ['create', 'read', 'update', 'export'],
    liabilities: ['create', 'read', 'update', 'export'],
    deals: ['read', 'export'],
    shares: ['read'],
    reports: ['read', 'create', 'export'],
    staff: ['create', 'read'],
    audit_logs: ['read'],
    settings: [],
    permissions: [],
  },
  SALES: {
    // Sales manager with access to deals and contacts
    assets: ['read'],
    liabilities: [],
    deals: ['create', 'read', 'update', 'export'],
    shares: ['read'],
    reports: ['read'],
    staff: [],
    audit_logs: [],
    settings: [],
    permissions: [],
  },
  AUDITOR: {
    // Auditor with read-only access to sensitive data
    assets: ['read', 'export'],
    liabilities: ['read', 'export'],
    deals: ['read', 'export'],
    shares: ['read'],
    reports: ['read', 'export'],
    staff: ['read'],
    audit_logs: ['read', 'export'],
    settings: [],
    permissions: [],
  },
  VIEWER: {
    // View-only access
    assets: ['read'],
    liabilities: ['read'],
    deals: ['read'],
    shares: ['read'],
    reports: ['read'],
    staff: [],
    audit_logs: [],
    settings: [],
    permissions: [],
  },
};

/**
 * Role hierarchy - used for inheritance and validation
 */
const ROLE_HIERARCHY = {
  FOUNDER: 6,
  ADMIN: 5,
  FINANCE: 4,
  SALES: 3,
  AUDITOR: 2,
  VIEWER: 1,
};

/**
 * Check if user can perform an action on a resource
 * @param {Object} user - User object with id, role, status
 * @param {string} resource - Resource type (assets, liabilities, deals, reports, staff, etc.)
 * @param {string} action - Action type (create, read, update, delete, etc.)
 * @returns {boolean} True if user has permission
 */
export function canAccess(user, resource, action) {
  if (!user) return false;
  // Superadmin bypasses ALL permission checks — no matrix lookup needed
  if (user.role === 'superadmin' || user.is_superadmin) return true;
  // Suspended users cannot access anything
  if (user.status === 'suspended') {
    return false;
  }

  // Check if user role exists in matrix
  const rolePermissions = PERMISSION_MATRIX[user.role];
  if (!rolePermissions) {
    return false;
  }

  // Check if resource exists in role permissions
  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) {
    return false;
  }

  // Check if action is allowed for this resource
  return resourcePermissions.includes(action);
}

/**
 * Check if a user can manage another user
 * Only higher-ranked roles can manage lower-ranked roles
 * @param {Object} manager - Manager user object
 * @param {Object} target - Target user object
 * @returns {boolean} True if manager can manage target
 */
export function canManageUser(manager, target) {
  if (manager.status === 'suspended') {
    return false;
  }

  const managerRank = ROLE_HIERARCHY[manager.role];
  const targetRank = ROLE_HIERARCHY[target.role];

  // Must have higher rank and be an admin-level role
  return managerRank > targetRank && managerRank >= 5;
}

/**
 * Check if user can access staff management
 * @param {Object} user - User object
 * @returns {boolean} True if user is FOUNDER or ADMIN
 */
export function isStaffAdmin(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return user.role === 'FOUNDER' || user.role === 'ADMIN';
}

/**
 * Check if user can modify financial records
 * @param {Object} user - User object
 * @returns {boolean} True if user is FOUNDER, ADMIN, or FINANCE
 */
export function isFinanceUser(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return ['FOUNDER', 'ADMIN', 'FINANCE'].includes(user.role);
}

/**
 * Check if user can manage deals
 * @param {Object} user - User object
 * @returns {boolean} True if user is FOUNDER, ADMIN, or SALES
 */
export function isSalesUser(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return ['FOUNDER', 'ADMIN', 'SALES'].includes(user.role);
}

/**
 * Check if user is an auditor
 * @param {Object} user - User object
 * @returns {boolean} True if user is AUDITOR or higher
 */
export function isAuditor(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return ['FOUNDER', 'ADMIN', 'AUDITOR'].includes(user.role);
}

/**
 * Check if user can soft delete/restore records
 * @param {Object} user - User object
 * @returns {boolean} True if user is FOUNDER or ADMIN
 */
export function canSoftDelete(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return ['FOUNDER', 'ADMIN'].includes(user.role);
}

/**
 * Check if user can lock/unlock records
 * @param {Object} user - User object
 * @returns {boolean} True if user is FOUNDER
 */
export function canLock(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return user.role === 'FOUNDER';
}

/**
 * Check if user can export data
 * @param {Object} user - User object
 * @returns {boolean} True if user is FOUNDER, ADMIN, or AUDITOR
 */
export function canExport(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return ['FOUNDER', 'ADMIN', 'AUDITOR'].includes(user.role);
}

/**
 * Get all available roles
 * @returns {string[]} Array of role names sorted by hierarchy
 */
export function getAllRoles() {
  return Object.keys(ROLE_HIERARCHY).sort((a, b) => ROLE_HIERARCHY[b] - ROLE_HIERARCHY[a]);
}

/**
 * Get permissions for a specific role
 * @param {string} role - Role name
 * @returns {Object} Permissions object
 */
export function getRolePermissions(role) {
  return PERMISSION_MATRIX[role] || null;
}

/**
 * Get role hierarchy level
 * @param {string} role - Role name
 * @returns {number} Hierarchy level (higher = more permissions)
 */
export function getRoleLevel(role) {
  return ROLE_HIERARCHY[role] || 0;
}

/**
 * Check if a role is higher than another
 * @param {string} role1 - First role
 * @param {string} role2 - Second role
 * @returns {boolean} True if role1 has higher privilege
 */
export function isRoleHigher(role1, role2) {
  return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2];
}

/**
 * Check if record is locked and user cannot edit it
 * @param {Object} record - Record object with locked property
 * @param {Object} user - User object
 * @returns {boolean} True if record is locked and user is not FOUNDER
 */
export function isRecordLocked(record, user) {
  if (user.role === 'FOUNDER') {
    return false; // Founders can always edit
  }
  return record.locked === true;
}

/**
 * Get role badge color for UI
 * @param {string} role - Role name
 * @returns {string} Color class name
 */
export function getRoleBadgeColor(role) {
  const colors = {
    FOUNDER: 'bg-red-100 text-red-800',
    ADMIN: 'bg-purple-100 text-purple-800',
    FINANCE: 'bg-blue-100 text-blue-800',
    SALES: 'bg-green-100 text-green-800',
    AUDITOR: 'bg-yellow-100 text-yellow-800',
    VIEWER: 'bg-muted text-foreground',
  };
  return colors[role] || 'bg-muted text-foreground';
}

/**
 * Get role display name
 * @param {string} role - Role name
 * @returns {string} Display name
 */
export function getRoleDisplayName(role) {
  const names = {
    FOUNDER: 'Founder',
    ADMIN: 'Administrator',
    FINANCE: 'Finance Manager',
    SALES: 'Sales Manager',
    AUDITOR: 'Auditor',
    VIEWER: 'Viewer',
  };
  return names[role] || role;
}

/**
 * Get role description for UI
 * @param {string} role - Role name
 * @returns {string} Role description
 */
export function getRoleDescription(role) {
  const descriptions = {
    FOUNDER: 'Full system access, manage all users and settings',
    ADMIN: 'Administrative access to all features except user roles',
    FINANCE: 'Manage financial records including assets and liabilities',
    SALES: 'Manage deals and sales opportunities',
    AUDITOR: 'Read-only access to all records for audit purposes',
    VIEWER: 'Read-only access to dashboards and reports',
  };
  return descriptions[role] || 'No description available';
}

// ============================================================================
// HIERARCHICAL AUTHORITY ENFORCEMENT
// Higher authority_level = more authority (Superadmin=100, Admin=80, ...)
// A viewer may only see/modify records whose creator_authority <= viewer_authority
// ============================================================================

/**
 * Get the viewer's authority level from a resolved auth object (or user id).
 * Superadmin always returns 100.
 */
export async function getViewerAuthorityLevel(userId, userRole) {
  if (userRole === 'superadmin') return 100;
  return getUserAuthorityLevel(userId);
}

/**
 * Build a SQL fragment that filters records so lower-authority viewers
 * cannot see records created by higher-authority actors.
 *
 * Usage:
 *   const { clause, params, nextIdx } = buildAuthorityFilter(viewerAuthority, {
 *     actorAuthorityCol: 'al.actor_authority_level',
 *     startIdx: 1,
 *   });
 *   sql += ` AND ${clause}`;
 *   queryParams.push(...params);
 *
 * For superadmins, returns an always-true clause (no filtering).
 */
export function buildAuthorityFilter(viewerAuthority, {
  actorAuthorityCol = 'actor_authority_level',
  startIdx = 1,
} = {}) {
  if (viewerAuthority >= 100) {
    // Superadmin sees everything
    return { clause: '1=1', params: [], nextIdx: startIdx };
  }
  return {
    clause: `${actorAuthorityCol} <= $${startIdx}`,
    params: [viewerAuthority],
    nextIdx: startIdx + 1,
  };
}

/**
 * Assert that the acting user has authority >= the record creator's authority.
 * Returns NextResponse 403 if blocked, or null if allowed.
 *
 * Usage in PATCH/DELETE routes:
 *   const block = await assertAuthorityOver(auth, recordRow.actor_authority_level);
 *   if (block) return block;
 */
export async function assertAuthorityOver(auth, recordCreatorAuthorityLevel) {
  // Superadmin is never blocked
  if (auth.role === 'superadmin') return null;

  const viewerAuthority = await getUserAuthorityLevel(auth.userId);

  if (viewerAuthority < recordCreatorAuthorityLevel) {
    return NextResponse.json(
      { error: 'Insufficient authority. You cannot modify records created by higher-authority users.' },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Require permission AND authority hierarchy.
 * If viewerAuthority < recordCreatorAuthority → 403.
 * Superadmin always passes.
 *
 * Convenience wrapper combining requirePermission + assertAuthorityOver.
 */
export async function requirePermissionAndAuthority(request, permission, recordCreatorAuthorityLevel) {
  const result = await requirePermission(request, permission);
  if (result instanceof NextResponse) return result;

  const block = await assertAuthorityOver(result.auth, recordCreatorAuthorityLevel ?? 0);
  if (block) return block;

  return result;
}
