'use client';

/**
 * /admin/role-permissions
 * Role Permission Manager — Superadmin only.
 *
 * Select a role → see all permissions grouped by module → toggle each on/off.
 * Uses PATCH /api/admin/roles/[roleId]/permissions for individual toggles.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Shield, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Loader2, Search, ShieldCheck, RefreshCw, Globe2, Building2, Lock,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { usePermissions } from '@/components/providers/PermissionProvider';

// ── Module display config ──────────────────────────────────────────────────
const MODULE_LABELS = {
  dashboard: 'Dashboard',
  users: 'Users',
  staff: 'Staff',
  roles: 'Roles & Permissions',
  finance: 'Finance',
  deals: 'Deals',
  clients: 'Clients',
  prospects: 'Prospects',
  reports: 'Reports',
  settings: 'Settings',
  audit: 'Audit Logs',
  departments: 'Departments',
  assets: 'Assets',
  systems: 'Systems',
  invoices: 'Invoices',
  approvals: 'Approvals',
  allocations: 'Allocations',
  intelligence: 'Intelligence',
  knowledge: 'Knowledge Base',
  media: 'Media',
  documents: 'Documents',
  liabilities: 'Liabilities',
  budgets: 'Budgets',
  expenses: 'Expenses',
  payments: 'Payments',
  contracts: 'Contracts',
  offerings: 'Offerings',
  services: 'Services',
  products: 'Products',
  licenses: 'Licenses',
  infrastructure: 'Infrastructure',
  operations: 'Operations',
  activity_logs: 'Activity Logs',
  notifications: 'Notifications',
  pipeline: 'Pipeline',
  employees: 'Employees',
};

const ACTION_COLOR = {
  view:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
  create: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  update: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  delete: 'text-red-400 bg-red-500/10 border-red-500/20',
  manage: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  export: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
};

const DATA_SCOPES = [
  { value: 'OWN',        label: 'Own Records',        Icon: Lock,      color: 'text-amber-600 dark:text-amber-400' },
  { value: 'DEPARTMENT', label: 'Department Records',  Icon: Building2, color: 'text-blue-600 dark:text-blue-400' },
  { value: 'GLOBAL',     label: 'All Records (Global)', Icon: Globe2,   color: 'text-green-600 dark:text-green-400' },
];

function PermissionToggle({ perm, enabled, onToggle, loading }) {
  const colorClass = ACTION_COLOR[perm.action] || 'text-muted-foreground bg-muted border-border';
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg border ${enabled ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border/50'} transition-all`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded border ${colorClass}`}>
          {perm.action}
        </span>
        <span className="text-xs text-muted-foreground truncate">{perm.description || `${perm.module}.${perm.action}`}</span>
      </div>
      <button
        onClick={() => onToggle(perm.id, !enabled)}
        disabled={loading}
        className="ml-3 shrink-0 transition-colors disabled:opacity-50"
        aria-label={enabled ? 'Disable permission' : 'Enable permission'}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : enabled ? (
          <ToggleRight className="w-6 h-6 text-primary" />
        ) : (
          <ToggleLeft className="w-6 h-6 text-muted-foreground/50" />
        )}
      </button>
    </div>
  );
}

export default function RolePermissionsPage() {
  const { user } = usePermissions();
  const toast = useToast();

  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [rolePerms, setRolePerms] = useState(new Set()); // set of permission IDs
  const [toggling, setToggling] = useState({}); // { permId: true }
  const [loadingRole, setLoadingRole] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [savingScope, setSavingScope] = useState(false);

  // Fetch roles + all permissions on mount
  useEffect(() => {
    Promise.all([
      fetchWithAuth('/api/admin/roles').then((r) => r.json()),
      fetchWithAuth('/api/admin/permissions').then((r) => r.json()),
    ])
      .then(([rolesData, permsData]) => {
        if (rolesData.success) setRoles(rolesData.data);
        if (permsData.success) setAllPermissions(permsData.data || []);
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoadingInit(false));
  }, []);

  // Fetch permissions for selected role
  const loadRolePerms = useCallback(async (roleId) => {
    setLoadingRole(true);
    try {
      const res = await fetchWithAuth(`/api/admin/roles/${roleId}/permissions`);
      const data = await res.json();
      if (data.success) {
        setRolePerms(new Set(data.data.map((p) => p.id)));
      }
    } catch {
      toast.error('Failed to load role permissions');
    } finally {
      setLoadingRole(false);
    }
  }, []);

  const selectRole = (role) => {
    setSelectedRole(role);
    setSearch('');
    loadRolePerms(role.id);
  };

  const togglePermission = async (permId, enable) => {
    if (!selectedRole) return;
    setToggling((prev) => ({ ...prev, [permId]: true }));
    try {
      const res = await fetchWithAuth(`/api/admin/roles/${selectedRole.id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission_id: permId, enabled: enable }),
      });
      const data = await res.json();
      if (data.success) {
        setRolePerms((prev) => {
          const next = new Set(prev);
          if (enable) next.add(permId);
          else next.delete(permId);
          return next;
        });
      } else {
        toast.error(data.error || 'Failed to toggle permission');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setToggling((prev) => { const n = { ...prev }; delete n[permId]; return n; });
    }
  };

  const updateDataScope = async (scope) => {
    if (!selectedRole) return;
    setSavingScope(true);
    try {
      const res = await fetchWithAuth(`/api/admin/roles/${selectedRole.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data_scope: scope }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedRole((prev) => ({ ...prev, data_scope: scope }));
        setRoles((prev) => prev.map((r) => r.id === selectedRole.id ? { ...r, data_scope: scope } : r));
        toast.success('Data scope updated');
      } else {
        toast.error(data.error || 'Failed to update data scope');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingScope(false);
    }
  };

  // Group all permissions by module
  const grouped = allPermissions.reduce((acc, p) => {
    (acc[p.module] = acc[p.module] || []).push(p);
    return acc;
  }, {});

  // Filter by search
  const searchLower = search.toLowerCase();
  const filteredModules = Object.entries(grouped).filter(([mod, perms]) => {
    if (!searchLower) return true;
    return (
      mod.toLowerCase().includes(searchLower) ||
      perms.some((p) => p.action.toLowerCase().includes(searchLower) || (p.description || '').toLowerCase().includes(searchLower))
    );
  });

  const enabledCount = rolePerms.size;
  const totalCount = allPermissions.length;

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Guard: superadmin only
  if (user && !user.is_superadmin) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>Superadmin access required.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 min-h-screen max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Role Permission Manager
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a role and toggle individual permissions per module.
          </p>
        </div>
        {selectedRole && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              <span className="text-foreground font-semibold">{enabledCount}</span>
              {' / '}{totalCount} permissions enabled
            </span>
            <button
              onClick={() => loadRolePerms(selectedRole.id)}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* ── Role Selector ──────────────────────────────────────────────── */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Roles ({roles.length})
          </h2>
          <div className="space-y-1">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => selectRole(role)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${
                  selectedRole?.id === role.id
                    ? 'bg-primary/10 border-primary/30 text-foreground font-medium'
                    : 'bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <div className="font-medium capitalize">{role.alias || role.name}</div>
                <div className="text-[11px] opacity-70 mt-0.5 flex items-center gap-2">
                  <span>{role.permission_count || 0} permissions · Level {role.hierarchy_level}</span>
                  {role.data_scope && role.data_scope !== 'GLOBAL' && (
                    <span className={`font-semibold ${
                      role.data_scope === 'OWN' ? 'text-amber-500' : 'text-blue-500'
                    }`}>
                      {role.data_scope}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Permission Grid ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          {!selectedRole ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border border-dashed border-border rounded-xl">
              <Shield className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Select a role to manage permissions</p>
            </div>
          ) : loadingRole ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search permissions…"
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Data Scope Selector */}
              <div className="bg-muted/30 border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Data Scope</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Controls which records this role can see when data-scoped APIs are called.</p>
                  </div>
                  {savingScope && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {DATA_SCOPES.map(({ value, label, Icon, color }) => {
                    const isActive = (selectedRole?.data_scope || 'GLOBAL') === value;
                    return (
                      <button
                        key={value}
                        onClick={() => updateDataScope(value)}
                        disabled={savingScope}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all disabled:opacity-60 ${
                          isActive
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? color : ''}`} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Module groups */}
              {filteredModules.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No permissions found.</p>
              ) : (
                filteredModules
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([mod, perms]) => {
                    const isOpen = collapsed[mod] !== true;
                    const enabledInModule = perms.filter((p) => rolePerms.has(p.id)).length;
                    return (
                      <div
                        key={mod}
                        className="border border-border rounded-xl overflow-hidden bg-card"
                      >
                        {/* Module header */}
                        <button
                          onClick={() => setCollapsed((prev) => ({ ...prev, [mod]: !prev[mod] }))}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground capitalize">
                              {MODULE_LABELS[mod] || mod}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {enabledInModule}/{perms.length}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Quick enable/disable all in module */}
                            {enabledInModule < perms.length ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  perms.filter((p) => !rolePerms.has(p.id)).forEach((p) => togglePermission(p.id, true));
                                }}
                                className="text-[11px] text-primary hover:underline"
                              >
                                Enable all
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  perms.forEach((p) => togglePermission(p.id, false));
                                }}
                                className="text-[11px] text-red-400 hover:underline"
                              >
                                Disable all
                              </button>
                            )}
                            {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </button>

                        {/* Permission toggles */}
                        {isOpen && (
                          <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {perms
                              .filter((p) =>
                                !searchLower ||
                                p.action.toLowerCase().includes(searchLower) ||
                                (p.description || '').toLowerCase().includes(searchLower)
                              )
                              .sort((a, b) => a.action.localeCompare(b.action))
                              .map((perm) => (
                                <PermissionToggle
                                  key={perm.id}
                                  perm={perm}
                                  enabled={rolePerms.has(perm.id)}
                                  onToggle={togglePermission}
                                  loading={!!toggling[perm.id]}
                                />
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
