'use client';

import { useEffect, useState, useCallback } from 'react';
import { Activity, Users, UserCheck, UserX, Shield, AlertTriangle, CheckCircle, RefreshCw, Wrench } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

function StatCard({ label, value, color = 'text-foreground', sub }) {
  return (
    <div className="bg-muted/50 dark:bg-white/[0.04] border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function IssueRow({ icon: Icon, label, value, severity = 'ok' }) {
  const colors = {
    ok:      'text-emerald-500',
    warn:    'text-amber-500',
    error:   'text-red-500',
  };
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${colors[severity]}`} />
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <span className={`text-sm font-semibold ${colors[severity]}`}>{value}</span>
    </div>
  );
}

export default function DebugPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [fixing, setFixing]   = useState(false);
  const [fixLog, setFixLog]   = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetchWithAuth('/api/admin/debug');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to load debug data');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runIntegrityFix() {
    setFixing(true);
    setFixLog([]);
    const log = (msg) => setFixLog(prev => [...prev, msg]);
    try {
      // Fix 1: link staff to users where email matches
      const r1 = await fetchWithAuth('/api/admin/debug/fix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'repair_links' }) });
      const j1 = await r1.json();
      log(j1.message || (j1.success ? '✓ Links repaired' : '✗ Link repair failed'));
    } catch (e) {
      log('✗ Fix failed: ' + e.message);
    } finally {
      setFixing(false);
      load();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-muted-foreground animate-pulse">Loading integrity data…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">{error}</div>
      </div>
    );
  }

  const { totals, users, staff, integrity, orphanUsers, staffWithoutUser, staffWithoutRole } = data;

  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-500" />
            Identity Integrity Debug Panel
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Superadmin-only. Verifies the user ↔ staff ↔ role triangle.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 border border-border rounded-xl text-sm text-foreground transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Health banner */}
      <div className={`rounded-xl p-4 flex items-center gap-3 border ${
        integrity.healthy
          ? 'bg-emerald-500/10 border-emerald-500/20'
          : 'bg-red-500/10 border-red-500/20'
      }`}>
        {integrity.healthy
          ? <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          : <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />}
        <span className={`font-medium text-sm ${integrity.healthy ? 'text-emerald-400' : 'text-red-400'}`}>
          {integrity.healthy
            ? 'Identity triangle is healthy — no orphan records detected.'
            : 'Identity integrity issues detected. Review the sections below.'}
        </span>
      </div>

      {/* Totals */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">System Totals</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Users"   value={totals.users}      color="text-blue-500"    />
          <StatCard label="Total Staff"   value={totals.staff}      color="text-purple-500"  />
          <StatCard label="Total Roles"   value={totals.roles}      color="text-amber-500"   />
          <StatCard label="Staff Roles"   value={totals.staffRoles} color="text-teal-500" sub="assignments" />
        </div>
      </div>

      {/* User health */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">User Health</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Linked"  value={users.linked}  color="text-emerald-500" sub="have staff_id" />
          <StatCard label="Orphan"  value={users.orphan}  color={users.orphan > 0 ? 'text-red-500' : 'text-emerald-500'} sub="no staff link" />
          <StatCard label="Active"  value={users.active}  color="text-green-500"  />
          <StatCard label="Pending" value={users.pending} color={users.pending > 0 ? 'text-amber-500' : 'text-muted-foreground'} />
        </div>
      </div>

      {/* Staff health */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Staff Health</h2>
        <div className="bg-muted/50 dark:bg-white/[0.04] border border-border rounded-xl p-4 space-y-1">
          <IssueRow icon={Users}   label="Staff without user account" value={staff.withoutUser}
            severity={staff.withoutUser > 0 ? 'warn' : 'ok'} />
          <IssueRow icon={Shield}  label="Staff without role assigned" value={staff.withoutRole}
            severity={staff.withoutRole > 0 ? 'error' : 'ok'} />
        </div>
      </div>

      {/* Orphan users list */}
      {orphanUsers?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <UserX className="w-4 h-4" /> Orphan Users (no staff_id)
          </h2>
          <div className="bg-muted/50 dark:bg-white/[0.04] border border-red-500/20 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2">Username</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Authority</th>
                </tr>
              </thead>
              <tbody>
                {orphanUsers.map(u => (
                  <tr key={u.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2 font-medium text-foreground">{u.username || '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-2"><span className="px-2 py-0.5 bg-muted rounded text-xs">{u.role}</span></td>
                    <td className="px-4 py-2 text-muted-foreground">{u.authority_level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Staff without user */}
      {staffWithoutUser?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <UserCheck className="w-4 h-4" /> Staff Without User Account
          </h2>
          <div className="bg-muted/50 dark:bg-white/[0.04] border border-amber-500/20 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                </tr>
              </thead>
              <tbody>
                {staffWithoutUser.map(s => (
                  <tr key={s.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2 font-medium text-foreground">{s.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.email || '—'}</td>
                    <td className="px-4 py-2"><span className="px-2 py-0.5 bg-muted rounded text-xs">{s.role_name || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Staff without role */}
      {staffWithoutRole?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Staff Without Role
          </h2>
          <div className="bg-muted/50 dark:bg-white/[0.04] border border-red-500/20 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                </tr>
              </thead>
              <tbody>
                {staffWithoutRole.map(s => (
                  <tr key={s.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2 font-medium text-foreground">{s.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.email || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fix log */}
      {fixLog.length > 0 && (
        <div className="bg-muted/50 border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Fix Output</p>
          {fixLog.map((l, i) => <p key={i} className="text-sm text-foreground font-mono">{l}</p>)}
        </div>
      )}

      {/* Enforcement reminder */}
      <div className="bg-muted/30 border border-border rounded-xl p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground text-sm">Identity Triangle Enforcement</p>
        <p>① Every staff must have a user account (linked via staff_id / linked_user_id)</p>
        <p>② Every user must be linked to a staff record (staff_id NOT NULL)</p>
        <p>③ Every staff must have at least one role (staff_roles entry)</p>
        <p>④ Every role must have an authority_level set</p>
        <p className="pt-1 text-red-400 font-medium">Breaking any of the above breaks RBAC, visibility, and audit chains.</p>
      </div>
    </div>
  );
}
