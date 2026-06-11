'use client';

/**
 * Permission Provider & Hook
 * Client-side permission context loaded from /api/auth/me
 * Provides: usePermissions() hook for checking permissions anywhere in the UI
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const PermissionContext = createContext({
  user: null,
  permissions: [],
  hierarchyLevel: 5,
  pendingApprovals: 0,
  loading: true,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasModuleAccess: () => false,
  refreshPermissions: () => {},
});

export function PermissionProvider({ children }) {
  const [state, setState] = useState({
    user: null,
    permissions: [],
    hierarchyLevel: 5,
    pendingApprovals: 0,
    loading: true,
  });

  const loadPermissions = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) {
        setState(prev => ({ ...prev, loading: false }));
        return;
      }
      const data = await res.json();
      const user = data.user;
      setState({
        user,
        permissions: user.permissions || [],
        hierarchyLevel: user.hierarchy_level ?? 5,
        pendingApprovals: user.pending_approvals ?? 0,
        loading: false,
      });
    } catch {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  /**
   * Check if user has a specific permission (e.g., 'deals.create')
   */
  const hasPermission = useCallback(
    (permission) => {
      if (!state.user) return false;
      if (state.user.is_superadmin) return true;
      if (state.permissions.includes('*')) return true;
      return state.permissions.includes(permission);
    },
    [state.user, state.permissions]
  );

  /**
   * Check if user has ANY of the given permissions
   */
  const hasAnyPermission = useCallback(
    (permissionList) => {
      if (!state.user) return false;
      if (state.user.is_superadmin) return true;
      if (state.permissions.includes('*')) return true;
      return permissionList.some(p => state.permissions.includes(p));
    },
    [state.user, state.permissions]
  );

  /**
   * Check if user has access to a module (any action on that module)
   */
  const hasModuleAccess = useCallback(
    (module) => {
      if (!state.user) return false;
      if (state.user.is_superadmin) return true;
      if (state.permissions.includes('*')) return true;
      return state.permissions.some(p => p.startsWith(`${module}.`));
    },
    [state.user, state.permissions]
  );

  const value = {
    ...state,
    hasPermission,
    hasAnyPermission,
    hasModuleAccess,
    refreshPermissions: loadPermissions,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

/**
 * Hook: use permissions context in any component
 */
export function usePermissions() {
  return useContext(PermissionContext);
}

/**
 * Component: conditionally render children based on permission
 */
export function PermissionGate({ permission, module, any, fallback = null, children }) {
  const { hasPermission: checkPerm, hasModuleAccess, hasAnyPermission } = usePermissions();

  if (permission && !checkPerm(permission)) return fallback;
  if (module && !hasModuleAccess(module)) return fallback;
  if (any && !hasAnyPermission(any)) return fallback;

  return children;
}

/**
 * Component: page-level guard that redirects to /app/unauthorized
 * when the current user lacks the required permission or module access.
 *
 * Usage:
 *   <PermissionGuard permission="finance.view">
 *     <FinancePage />
 *   </PermissionGuard>
 *
 *   <PermissionGuard module="reports">  — any action on 'reports' module
 *   <PermissionGuard any={['deals.view','clients.view']}>
 */
export function PermissionGuard({ permission, module, any, children }) {
  const { loading, hasPermission: checkPerm, hasModuleAccess, hasAnyPermission } = usePermissions();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const allowed =
      (permission && checkPerm(permission)) ||
      (module && hasModuleAccess(module)) ||
      (any && hasAnyPermission(any));

    if (!allowed) {
      router.replace('/app/unauthorized');
    }
  }, [loading, permission, module, any, checkPerm, hasModuleAccess, hasAnyPermission, router]);

  // While permissions load, render nothing (prevents flash)
  if (loading) return null;

  const allowed =
    (permission && checkPerm(permission)) ||
    (module && hasModuleAccess(module)) ||
    (any && hasAnyPermission(any));

  if (!allowed) return null;

  return children;
}
