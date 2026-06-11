'use client';

/**
 * /admin/access-simulator
 * Access Simulator — Superadmin debugging tool.
 *
 * Select any role → preview every module/action that role can access.
 * This lets the superadmin verify permission definitions before assigning roles.
 */

import { useEffect, useState } from 'react';
import {
  FlaskConical, Shield, ChevronDown, ChevronUp,
  Loader2, Search, CheckCircle2, XCircle, Eye,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { usePermissions } from '@/components/providers/PermissionProvider';
import { useToast } from '@/components/ui/Toast';

// Module display labels (same as role-permissions page)
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
  view:   'text-blue-400',
  create: 'text-emerald-400',
  update: 'text-amber-400',
  delete: 'text-red-400',
  manage: 'text-purple-400',
  export: 'text-cyan-400',
};

export default function AccessSimulatorPage() {
  const { user } = usePermissions();
  const toast = useToast();

  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [rolePermIds, setRolePermIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingRole, setLoadingRole] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | granted | denied
  const [collapsed, setCollapsed] = useState({});

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
      .finally(() => setLoading(false));
  }, []);

  const selectRole = async (role) => {
    setSelectedRole(role);
    setLoadingRole(true);
    try {
      const res = await fetchWithAuth(`/api/admin/roles/${role.id}/permissions`);
      const data = await res.json();
      if (data.success) {
        setRolePermIds(new Set(data.data.map((p) => p.id)));
      }
    } catch {
      toast.error('Failed to load role permissions');
    } finally {
      setLoadingRole(false);
    }
  };

  // Group all permissions by module
  const grouped = allPermissions.reduce((acc, p) => {
    (acc[p.module] = acc[p.module] || []).push(p);
    return acc;
  }, {});

  const searchLower = search.toLowerCase();

  // Stats
  const grantedCount = rolePermIds.size;
  const deniedCount = allPermissions.length - grantedCount;

  // Accessible modules (has at least one granted permission)
  const accessibleModules = Object.keys(grouped).filter((mod) =>
    grouped[mod].some((p) => rolePermIds.has(p.id))
  );

  const filteredModules = Object.entries(grouped).filter(([mod, perms]) => {
    // Apply search
    const matchesSearch =
      !searchLower ||
      mod.toLowerCase().includes(searchLower) ||
      perms.some(
        (p) =>
          p.action.toLowerCase().includes(searchLower) ||
          (p.description || '').toLowerCase().includes(searchLower)
      );

    // Apply access filter
    const hasGranted = perms.some((p) => rolePermIds.has(p.id));
    const hasDenied = perms.some((p) => !rolePermIds.has(p.id));
    const matchesFilter =
      filter === 'all' ||
      (filter === 'granted' && hasGranted) ||
      (filter === 'denied' && hasDenied);

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-primary" />
          Access Simulator
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preview what modules and actions a role can access. Use this to verify
          permission definitions before assigning roles to staff.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* ── Role Selector ──────────────────────────────────────────────── */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Simulate Role
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
                <div className="text-[11px] opacity-70 mt-0.5">
                  Hierarchy Level {role.hierarchy_level} · {role.user_count || 0} users
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Simulation Panel ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          {!selectedRole ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border border-dashed border-border rounded-xl">
              <Eye className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Select a role to preview its access</p>
            </div>
          ) : loadingRole ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Role summary banner */}
              <div className="flex flex-wrap gap-4 p-4 rounded-xl bg-card border border-border">
                <div className="text-sm">
                  <span className="text-muted-foreground">Simulating: </span>
                  <span className="font-semibold text-foreground capitalize">
                    {selectedRole.alias || selectedRole.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  {grantedCount} granted
                </div>
                <div className="flex items-center gap-1.5 text-sm text-red-400">
                  <XCircle className="w-4 h-4" />
                  {deniedCount} denied
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4" />
                  {accessibleModules.length} accessible modules
                </div>
              </div>

              {/* Accessible module list */}
              {accessibleModules.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {accessibleModules.sort().map((mod) => (
                    <span
                      key={mod}
                      className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    >
                      {MODULE_LABELS[mod] || mod}
                    </span>
                  ))}
                </div>
              )}

              {/* Controls */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search permissions…"
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div className="flex rounded-xl border border-border overflow-hidden text-xs">
                  {['all', 'granted', 'denied'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-2 capitalize transition-colors ${
                        filter === f
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Module breakdown */}
              {filteredModules.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-8">No permissions found.</p>
              ) : (
                filteredModules
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([mod, perms]) => {
                    const isOpen = collapsed[mod] !== true;
                    const granted = perms.filter((p) => rolePermIds.has(p.id));
                    const denied  = perms.filter((p) => !rolePermIds.has(p.id));
                    const hasAny = granted.length > 0;

                    return (
                      <div
                        key={mod}
                        className={`border rounded-xl overflow-hidden ${hasAny ? 'bg-card border-border' : 'bg-muted/20 border-border/40'}`}
                      >
                        <button
                          onClick={() => setCollapsed((prev) => ({ ...prev, [mod]: !prev[mod] }))}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {hasAny ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400/60 shrink-0" />
                            )}
                            <span className={`font-semibold text-sm capitalize ${hasAny ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {MODULE_LABELS[mod] || mod}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {granted.length}/{perms.length} actions
                            </span>
                          </div>
                          {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </button>

                        {isOpen && (
                          <div className="px-4 pb-3 flex flex-wrap gap-2">
                            {perms
                              .filter((p) => {
                                if (filter === 'granted') return rolePermIds.has(p.id);
                                if (filter === 'denied')  return !rolePermIds.has(p.id);
                                return true;
                              })
                              .filter((p) =>
                                !searchLower ||
                                p.action.toLowerCase().includes(searchLower) ||
                                (p.description || '').toLowerCase().includes(searchLower)
                              )
                              .sort((a, b) => a.action.localeCompare(b.action))
                              .map((perm) => {
                                const allowed = rolePermIds.has(perm.id);
                                return (
                                  <div
                                    key={perm.id}
                                    title={perm.description}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${
                                      allowed
                                        ? `${ACTION_COLOR[perm.action] || 'text-foreground'} bg-current/5 border-current/20`
                                        : 'text-muted-foreground/40 bg-muted/20 border-border/30 line-through'
                                    }`}
                                  >
                                    {allowed ? (
                                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                                    ) : (
                                      <XCircle className="w-3 h-3 shrink-0" />
                                    )}
                                    {perm.action}
                                  </div>
                                );
                              })}
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
