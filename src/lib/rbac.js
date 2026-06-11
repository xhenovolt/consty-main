/**
 * Central RBAC Utility — Consty
 * ─────────────────────────────────────────────────────────────────────────────
 * Synchronous permission checking for use after the async verifyAuth /
 * requirePermission call has already established the user's identity.
 *
 * Use canAccess() everywhere:
 *   • API route handlers  (after requirePermission resolves the auth object)
 *   • Data sanitizers     (before building API response objects)
 *   • UI components       (after usePermissions() resolves)
 *
 * HARD RULE: Superadmin bypasses ALL checks.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Core access check — the single source of truth.
 *
 * @param {object} user         Object with: role, is_superadmin, status, permissions[]
 *                              `permissions` comes from /api/auth/me (PermissionProvider) or
 *                              from the auth object returned by requirePermission().
 * @param {string} permission   e.g. 'finance.view', 'deals.create'
 * @returns {boolean}
 */
export function canAccess(user, permission) {
  if (!user) return false;
  // Superadmin always wins — no further checks needed
  if (user.role === 'superadmin' || user.is_superadmin === true) return true;
  if (user.status === 'suspended') return false;
  const perms = user.permissions || [];
  // Wildcard issued to superadmin by /api/auth/me (defence-in-depth)
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

// ─── Financial field definitions ──────────────────────────────────────────────

/** Fields stripped from /api/systems list rows when caller lacks finance.view */
const SYSTEM_FINANCIAL_FIELDS = ['total_revenue', 'revenue'];

/** Fields stripped from deal objects when caller lacks finance.view */
const DEAL_FINANCIAL_FIELDS = [
  'total_amount',
  'paid_amount',
  'remaining_amount',
  'outstanding_balance',
];

/**
 * Strip financial fields from a single /api/systems list row.
 * Call this for every row when the requesting user lacks 'finance.view'.
 *
 * @param {object} system  A row returned by the systems query
 * @returns {object}       Sanitized copy (original is NOT mutated)
 */
export function sanitizeSystemRecord(system) {
  const result = { ...system };
  for (const field of SYSTEM_FINANCIAL_FIELDS) delete result[field];
  return result;
}

/**
 * Strip all financial data from a /api/systems/[id] detail response.
 * Removes revenue fields from the system object AND financial fields from
 * every nested deal record.
 *
 * @param {object} systemData  Full system detail object (may include .deals[])
 * @returns {object}           Sanitized deep copy (original is NOT mutated)
 */
export function sanitizeSystemDetail(systemData) {
  const result = { ...systemData };
  for (const field of SYSTEM_FINANCIAL_FIELDS) delete result[field];
  if (Array.isArray(result.deals)) {
    result.deals = result.deals.map((deal) => {
      const cleanDeal = { ...deal };
      for (const field of DEAL_FINANCIAL_FIELDS) delete cleanDeal[field];
      return cleanDeal;
    });
  }
  return result;
}
