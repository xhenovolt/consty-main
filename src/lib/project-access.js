/**
 * Per-project access control — implements the locked decision:
 *   "Membership-gated + admin override."
 *
 * - Global superadmin/admin bypass membership entirely (full access).
 * - Everyone else must have an active project_members row; their project_role(s)
 *   decide what they can do inside the project.
 *
 * Used by /api/projects/[id]/* after the global requirePermission() gate.
 * `auth` is the object returned by requirePermission()/verifyAuth() ({ userId, role }).
 */
import { query } from '@/lib/db.js';

const GLOBAL_ADMIN_ROLES = ['superadmin', 'admin'];
// Project roles allowed to mutate work/data inside a project.
const EDIT_ROLES = ['governor', 'manager', 'stage_leader', 'contributor',
                    'procurement_officer', 'storekeeper', 'inspector', 'accountant', 'field_worker'];
// Project roles allowed to add/remove members.
const MEMBER_ADMIN_ROLES = ['governor', 'manager'];

export async function getProjectAccess(auth, projectId) {
  if (!auth?.userId) return { allowed: false };

  if (GLOBAL_ADMIN_ROLES.includes(auth.role)) {
    return { allowed: true, isAdmin: true, roles: ['admin'], canEdit: true, canManageMembers: true };
  }

  const { rows } = await query(
    `SELECT project_role FROM project_members
      WHERE project_id = $1 AND user_id = $2 AND status = 'active'`,
    [projectId, auth.userId]
  );
  if (rows.length === 0) return { allowed: false };

  const roles = rows.map(r => r.project_role);
  return {
    allowed: true,
    isAdmin: false,
    roles,
    canEdit: roles.some(r => EDIT_ROLES.includes(r)),
    canManageMembers: roles.some(r => MEMBER_ADMIN_ROLES.includes(r)),
  };
}

/**
 * Returns { ok:true, access } or { ok:false, status, error }.
 * Pass { write } for mutations, { manageMembers } for membership changes.
 */
export async function assertProjectAccess(auth, projectId, opts = {}) {
  const access = await getProjectAccess(auth, projectId);
  if (!access.allowed)
    return { ok: false, status: 403, error: 'You are not a member of this project' };
  if (opts.write && !access.canEdit)
    return { ok: false, status: 403, error: 'Your project role cannot modify this project' };
  if (opts.manageMembers && !access.canManageMembers)
    return { ok: false, status: 403, error: 'Only a governor or manager can manage members' };
  return { ok: true, access };
}

/** SQL fragment + params to scope a project list to what `auth` may see. */
export function projectVisibilityFilter(auth, paramOffset = 0) {
  if (GLOBAL_ADMIN_ROLES.includes(auth?.role)) return { clause: '', params: [] };
  return {
    clause: ` AND p.id IN (SELECT project_id FROM project_members
                            WHERE user_id = $${paramOffset + 1} AND status = 'active')`,
    params: [auth.userId],
  };
}
