'use client';

import { useEffect, useState } from 'react';
import {
  Shield, Users, AlertTriangle, CheckCircle2, Trash2, Link2, RefreshCw,
  Archive, Power, X, Loader2,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const STATUS_BADGE = {
  linked:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  superadmin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  allowed:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  phantom:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  dangling:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const ACCOUNT_BADGE = {
  active:    'bg-emerald-100 text-emerald-700',
  pending:   'bg-yellow-100 text-yellow-700',
  suspended: 'bg-orange-100 text-orange-700',
  disabled:  'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export default function IdentityHealthPage() {
  const [report, setReport]   = useState(null);
  const [users, setUsers]     = useState([]);
  const [staff, setStaff]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState(null);
  const [linkModal, setLinkModal] = useState(null); // user
  const [linkStaffId, setLinkStaffId] = useState('');
  const [tab, setTab] = useState('all');
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [h, u, s] = await Promise.all([
        fetchWithAuth('/api/admin/identity/health').then(r => r.json()),
        fetchWithAuth('/api/users').then(r => r.json()),
        fetchWithAuth('/api/staff').then(r => r.json()),
      ]);
      if (h.success) setReport(h.report);
      if (u.success) setUsers(u.data || []);
      if (s.success) setStaff(s.data || []);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const generateReport = async () => {
    setBusyId('report');
    try {
      const r = await fetchWithAuth('/api/admin/identity/health', { method: 'POST' }).then(x => x.json());
      if (r.success) {
        toast.success(r.passed ? 'Health check passed' : 'Issues detected — see details');
        setReport(r.report);
      } else toast.error(r.error || 'Failed');
    } finally { setBusyId(null); }
  };

  const repair = async (action, params) => {
    setBusyId(`${action}_${params?.user_id || params?.staff_id || 'all'}`);
    try {
      const r = await fetchWithAuth('/api/admin/identity/repair', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
      }).then(x => x.json());
      if (r.success) { toast.success('Repaired'); load(); }
      else toast.error(r.error || 'Failed');
    } finally { setBusyId(null); }
  };

  const userAction = async (id, action) => {
    setBusyId(id);
    try {
      const r = await fetchWithAuth('/api/users', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      }).then(x => x.json());
      if (r.success) { toast.success(action); load(); } else toast.error(r.error || 'Failed');
    } finally { setBusyId(null); }
  };

  const deleteUser = async (id, force = false) => {
    if (!confirm(force ? 'Force-delete user and all sessions?' : 'Delete this phantom user?')) return;
    setBusyId(id);
    try {
      const r = await fetchWithAuth(`/api/users?id=${id}${force ? '&force=true' : ''}`, { method: 'DELETE' })
        .then(x => x.json());
      if (r.success) { toast.success('Deleted'); load(); } else toast.error(r.error || 'Failed');
    } finally { setBusyId(null); }
  };

  const linkUser = async () => {
    if (!linkStaffId || !linkModal) return;
    setBusyId(`link_${linkModal.id}`);
    try {
      const r = await fetchWithAuth('/api/admin/identity/repair', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link_phantom_user_to_staff', user_id: linkModal.id, staff_id: linkStaffId }),
      }).then(x => x.json());
      if (r.success) { toast.success('Linked'); setLinkModal(null); setLinkStaffId(''); load(); }
      else toast.error(r.error || 'Failed');
    } finally { setBusyId(null); }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading identity health…</div>;

  const filtered = tab === 'all' ? users
    : tab === 'phantom' ? users.filter(u => u.link_status === 'phantom')
    : tab === 'dangling' ? users.filter(u => u.link_status === 'dangling')
    : users.filter(u => u.status !== 'active');

  const passed = report && report.phantom_users === 0 && report.staff_no_user === 0
    && report.dangling_refs === 0 && report.pointer_mismatches === 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Identity Architecture Health</h1>
            <p className="text-sm text-muted-foreground">Users, staff, and the linkage between them.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted inline-flex items-center gap-1.5 cursor-pointer">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={generateReport} disabled={busyId === 'report'}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer">
            <CheckCircle2 className="w-4 h-4" /> Generate Health Report
          </button>
        </div>
      </div>

      {/* Health summary */}
      {report && (
        <div className={`border rounded-xl p-5 ${passed ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900' : 'bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-900'}`}>
          <div className="flex items-center gap-3">
            {passed ? <CheckCircle2 className="w-6 h-6 text-emerald-600" /> : <AlertTriangle className="w-6 h-6 text-amber-600" />}
            <h2 className={`font-semibold ${passed ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {passed ? 'Identity architecture is healthy' : 'Issues detected'}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-4">
            <Stat label="Users" value={report.total_users} />
            <Stat label="Staff" value={report.total_staff} />
            <Stat label="Phantom users"  value={report.phantom_users}     color={report.phantom_users     ? 'text-red-600' : 'text-emerald-600'} />
            <Stat label="Staff w/o user" value={report.staff_no_user}     color={report.staff_no_user     ? 'text-red-600' : 'text-emerald-600'} />
            <Stat label="Pointer mismatches" value={report.pointer_mismatches} color={report.pointer_mismatches ? 'text-amber-600' : 'text-emerald-600'} />
            <Stat label="Dangling refs"  value={report.dangling_refs}     color={report.dangling_refs     ? 'text-amber-600' : 'text-emerald-600'} />
            <Stat label="Orphan sessions" value={report.orphan_sessions}  color={report.orphan_sessions   ? 'text-amber-600' : 'text-emerald-600'} />
          </div>
          {report.orphan_sessions > 0 && (
            <button onClick={() => repair('clear_orphan_sessions')}
              className="mt-3 text-xs text-primary hover:underline cursor-pointer">
              Clear {report.orphan_sessions} orphan session{report.orphan_sessions !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          ['all',      `All Users (${users.length})`],
          ['phantom',  `Phantom (${users.filter(u => u.link_status === 'phantom').length})`],
          ['dangling', `Dangling (${users.filter(u => u.link_status === 'dangling').length})`],
          ['inactive', `Inactive (${users.filter(u => u.status !== 'active').length})`],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 cursor-pointer ${tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Users table */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          No users in this category.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/30">
                <Th>User</Th><Th>Role</Th><Th>Linkage</Th><Th>Status</Th><Th>Created</Th><Th>Actions</Th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{u.full_name || u.name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{u.email} {u.username && <span className="ml-1 font-mono">@{u.username}</span>}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{u.role_name || u.role}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[u.link_status] || 'bg-muted'}`}>{u.link_status}</span></td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACCOUNT_BADGE[u.status] || 'bg-muted'}`}>{u.status}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 flex flex-wrap items-center gap-1.5">
                      {u.link_status === 'phantom' && (
                        <>
                          <button onClick={() => { setLinkModal(u); setLinkStaffId(''); }}
                            className="p-1.5 rounded hover:bg-muted text-blue-600 cursor-pointer" title="Link to staff">
                            <Link2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => repair('delete_phantom_user', { user_id: u.id })}
                            disabled={busyId === `delete_phantom_user_${u.id}`}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 disabled:opacity-50 cursor-pointer dark:bg-red-900/30 dark:text-red-300" title="Delete phantom">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {u.link_status === 'dangling' && (
                        <button onClick={() => repair('detach_dangling_staff_ref', { user_id: u.id })}
                          className="p-1.5 rounded hover:bg-muted text-amber-600 cursor-pointer" title="Detach broken staff link">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      {u.status === 'active' ? (
                        <button onClick={() => userAction(u.id, 'archive')} disabled={busyId === u.id}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-50 cursor-pointer" title="Archive">
                          <Archive className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => userAction(u.id, 'restore')} disabled={busyId === u.id}
                          className="p-1.5 rounded hover:bg-muted text-emerald-600 disabled:opacity-50 cursor-pointer" title="Restore">
                          <Power className="w-4 h-4" />
                        </button>
                      )}
                      {u.role !== 'superadmin' && !u.staff_id && (
                        <button onClick={() => deleteUser(u.id)} disabled={busyId === u.id}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 disabled:opacity-50 cursor-pointer dark:bg-red-900/30 dark:text-red-300" title="Hard delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Link phantom → staff modal */}
      {linkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-lg">Link Phantom User to Staff</h3>
              <button onClick={() => setLinkModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-sm text-muted-foreground">
              Linking <strong className="text-foreground">{linkModal.email}</strong> to a staff member.
            </div>
            <select value={linkStaffId} onChange={e => setLinkStaffId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm [&>option]:bg-background">
              <option value="">— Select staff —</option>
              {staff.filter(s => !s.user_id).map(s => (
                <option key={s.id} value={s.id}>{s.name} · {s.dept_name || s.department || '—'} · {s.email || 'no email'}</option>
              ))}
            </select>
            <div className="text-xs text-muted-foreground">Only staff without an existing user are listed.</div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setLinkModal(null)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted cursor-pointer">Cancel</button>
              <button onClick={linkUser} disabled={!linkStaffId || busyId === `link_${linkModal.id}`}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 cursor-pointer">
                {busyId === `link_${linkModal.id}` ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Th = ({ children }) => <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{children}</th>;
function Stat({ label, value, color = 'text-foreground' }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value ?? 0}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
