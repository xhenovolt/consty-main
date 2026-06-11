'use client';

/**
 * /admin/authority-inspector
 * Authority Inspector — superadmin / roles.manage tool.
 *
 * Displays every user alongside their:
 *   - Assigned RBAC roles
 *   - Effective authority_level (numeric)
 *   - Staff link status
 *   - First-login completion
 *
 * Allows verification that hierarchical enforcement is working correctly.
 * Access: superadmin or users with roles.manage permission.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Shield, User, Users, Search, RefreshCw, Loader2, AlertCircle,
  ChevronDown, ChevronRight, UserCheck, UserX, Lock, Unlock, Info,
} from 'lucide-react';
import { usePermissions } from '@/components/providers/PermissionProvider';
import { fetchWithAuth } from '@/lib/fetch-client';

// ─── Authority Level colour mapping ────────────────────────────────────────
function authorityColor(level) {
  if (level >= 100) return 'bg-red-100 text-red-800 border-red-200';
  if (level >= 80)  return 'bg-purple-100 text-purple-800 border-purple-200';
  if (level >= 60)  return 'bg-blue-100 text-blue-800 border-blue-200';
  if (level >= 40)  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (level >= 20)  return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-muted text-muted-foreground border-border';
}

function authorityLabel(level) {
  if (level >= 100) return 'Superadmin (100)';
  if (level >= 80)  return `Admin (${level})`;
  if (level >= 60)  return `Manager (${level})`;
  if (level >= 40)  return `Staff (${level})`;
  if (level >= 20)  return `Viewer (${level})`;
  return `Squire (${level})`;
}

// ─── Hierarchy scale bar ─────────────────────────────────────────────────────
function AuthorityBar({ level }) {
  const pct = Math.min(Math.max(level, 0), 100);
  const color = level >= 80 ? 'bg-purple-500' : level >= 60 ? 'bg-blue-500' : level >= 40 ? 'bg-emerald-500' : 'bg-amber-400';
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function AuthorityInspectorPage() {
  const { user: currentUser } = usePermissions();

  const [users, setUsers]         = useState([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [expanded, setExpanded]   = useState({});
  const [filter, setFilter]       = useState('all'); // 'all' | 'unlinked' | 'no-first-login'

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetchWithAuth('/api/admin/authority-inspector');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load');
      setUsers(data.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u => {
    if (filter === 'unlinked'        && u.linked_user_id)        return false;
    if (filter === 'no-first-login'  && u.first_login_completed) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        u.name?.toLowerCase().includes(q)  ||
        u.email?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        (u.assigned_roles || []).some(r => r.name?.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Stats
  const totalUsers      = users.length;
  const unlinkedStaff   = users.filter(u => u.staff_id && !u.linked_user_id).length;
  const pendingFirst    = users.filter(u => !u.first_login_completed).length;
  const superadmins     = users.filter(u => u.authority_level >= 100).length;

  if (!currentUser?.is_superadmin && !(currentUser?.permissions || []).includes('roles.manage')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">Access Denied</p>
          <p className="text-sm text-muted-foreground mt-1">You need the <code>roles.manage</code> permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-600" /> Authority Inspector
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verify role authority levels and hierarchical enforcement across all users.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-4">
          <div className="text-2xl font-bold text-foreground">{totalUsers}</div>
          <div className="text-xs text-muted-foreground mt-1">Total User Accounts</div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="text-2xl font-bold text-purple-600">{superadmins}</div>
          <div className="text-xs text-muted-foreground mt-1">Superadmins (level 100)</div>
        </div>
        <div className={`bg-card border rounded-xl p-4 ${unlinkedStaff > 0 ? 'border-amber-300' : ''}`}>
          <div className={`text-2xl font-bold ${unlinkedStaff > 0 ? 'text-amber-600' : 'text-foreground'}`}>{unlinkedStaff}</div>
          <div className="text-xs text-muted-foreground mt-1">Staff Without Linked Account</div>
        </div>
        <div className={`bg-card border rounded-xl p-4 ${pendingFirst > 0 ? 'border-orange-300' : ''}`}>
          <div className={`text-2xl font-bold ${pendingFirst > 0 ? 'text-orange-600' : 'text-foreground'}`}>{pendingFirst}</div>
          <div className="text-xs text-muted-foreground mt-1">Pending First Login</div>
        </div>
      </div>

      {/* Infobox */}
      <div className="flex gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-300">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          Hierarchy rule: users may only view/modify records created by users whose authority_level is{' '}
          <strong>≤ their own</strong>. Superadmin (100) bypasses all restrictions.
        </p>
      </div>

      {/* Filter + search bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, username, role..."
            className="w-full px-3 py-2 pl-9 border border-border rounded-lg bg-background text-foreground text-sm"
          />
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
        </div>
        <div className="flex gap-2">
          {[
            { value: 'all',            label: 'All Users' },
            { value: 'unlinked',       label: 'Unlinked Staff' },
            { value: 'no-first-login', label: 'Pending First Login' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === f.value ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No users match your filter.</div>
      ) : (
        <div className="bg-card rounded-xl border divide-y divide-border">
          {filtered.map(u => {
            const roles  = u.assigned_roles || [];
            const isOpen = expanded[u.id];
            return (
              <div key={u.id}>
                {/* Row */}
                <button
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition text-left"
                  onClick={() => setExpanded(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                >
                  {/* User icon */}
                  <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm flex-shrink-0 dark:bg-violet-900/30 dark:text-violet-300">
                    {u.name?.charAt(0) || u.email?.charAt(0) || '?'}
                  </div>

                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground text-sm">{u.name || u.email}</span>
                      {u.username && <span className="text-xs text-muted-foreground">@{u.username}</span>}
                      {/* Account link status */}
                      {u.staff_id ? (
                        u.linked_user_id
                          ? <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded dark:bg-emerald-900/30 dark:text-emerald-300"><UserCheck className="w-2.5 h-2.5" />Staff linked</span>
                          : <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded dark:bg-amber-900/30 dark:text-amber-300"><UserX className="w-2.5 h-2.5" />Staff unlinked</span>
                      ) : null}
                      {/* First login */}
                      {!u.first_login_completed && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded dark:bg-orange-900/30 dark:text-orange-300">
                          <Lock className="w-2.5 h-2.5" />First login pending
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}{u.position ? ` · ${u.position}` : ''}</div>
                    {/* Authority bar */}
                    <div className="mt-1.5" style={{ maxWidth: 200 }}>
                      <AuthorityBar level={u.authority_level ?? 0} />
                    </div>
                  </div>

                  {/* Authority badge */}
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium flex-shrink-0 ${authorityColor(u.authority_level ?? 0)}`}>
                    <Shield className="w-3 h-3" />
                    {authorityLabel(u.authority_level ?? 0)}
                  </div>

                  {/* Expand chevron */}
                  <div className="text-muted-foreground flex-shrink-0">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30">
                    {/* Identity detail */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identity</h4>
                      <dl className="space-y-1">
                        {[
                          { label: 'Email',           value: u.email },
                          { label: 'Username',        value: u.username || '—' },
                          { label: 'Base role',       value: u.base_role },
                          { label: 'Status',          value: u.status },
                          { label: 'Active',          value: u.is_active ? 'Yes' : 'No' },
                          { label: 'Last login',      value: u.last_login ? new Date(u.last_login).toLocaleString() : 'Never' },
                          { label: 'First login',     value: u.first_login_completed ? 'Completed' : 'Pending' },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-medium text-foreground">{value ?? '—'}</span>
                          </div>
                        ))}
                      </dl>
                    </div>

                    {/* Roles detail */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Assigned Roles ({roles.length})
                      </h4>
                      {roles.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No RBAC roles assigned</p>
                      ) : (
                        <div className="space-y-1.5">
                          {roles.map(r => (
                            <div key={r.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Shield className="w-3 h-3 text-violet-600" />
                                <span className="text-sm font-medium text-foreground">{r.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded border ${authorityColor(r.authority_level ?? 0)}`}>
                                  authority {r.authority_level ?? '?'}
                                </span>
                                {r.hierarchy_level && (
                                  <span className="text-xs text-muted-foreground">hierarchy L{r.hierarchy_level}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Effective authority */}
                      <div className="mt-3 p-2 bg-card rounded-lg border">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Effective authority_level</span>
                          <span className={`font-bold px-2 py-0.5 rounded border ${authorityColor(u.authority_level ?? 0)}`}>
                            {u.authority_level ?? 0}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Can see records from users with authority ≤ {u.authority_level ?? 0}.
                          {(u.authority_level ?? 0) >= 100 && ' Superadmin bypasses all checks.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
