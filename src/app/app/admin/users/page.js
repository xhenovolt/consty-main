'use client';

import { useEffect, useState } from 'react';
import { Users, Shield, ShieldCheck, Edit, X, Check, UserX, UserCheck, Search, ChevronDown, MoreVertical, Trash2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const STATUS_STYLES = {
  active: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  pending: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  suspended: 'bg-red-500/15 text-red-400 border border-red-500/20',
  disabled: 'bg-gray-500/15 text-muted-foreground border border-gray-500/20',
  inactive: 'bg-gray-500/15 text-muted-foreground border border-gray-500/20',
};

const ROLE_STYLES = {
  superadmin: 'bg-red-500/15 text-red-400 border border-red-500/20',
  admin: 'bg-purple-500/15 text-purple-400 border border-purple-500/20',
  user: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  viewer: 'bg-gray-500/15 text-muted-foreground border border-gray-500/20',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ role: '', status: '' });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchUsers();
    fetchWithAuth('/api/admin/roles').then(r => r.json()).then(j => { if (j.success) setRoles(j.data || []); }).catch(() => {});
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/users');
      const j = await res.json();
      if (j.success) setUsers(j.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const startEdit = (u) => { setEditUser(u); setEditForm({ role: u.role, status: u.status || 'active' }); };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/admin/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if ((await res.json()).success) { toast.success('User updated'); setEditUser(null); fetchUsers(); }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const deleteUser = async (userId) => {
    setDeleting(true);
    try {
      const res = await fetchWithAuth(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`User deleted successfully`);
        setDeleteConfirm(null);
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = users
    .filter((u) => filter === 'all' || u.status === filter || u.role === filter)
    .filter((u) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (u.name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
    });

  const counts = {
    all: users.length,
    active: users.filter((u) => u.status === 'active').length,
    pending: users.filter((u) => u.status === 'pending').length,
    suspended: users.filter((u) => u.status === 'suspended').length,
  };

  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} registered users</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: counts.all, color: 'var(--theme-primary, #3b82f6)' },
          { label: 'Active', value: counts.active, color: '#10b981' },
          { label: 'Pending', value: counts.pending, color: '#f59e0b' },
          { label: 'Suspended', value: counts.suspended, color: '#ef4444' },
        ].map((s) => (
          <div key={s.label} className="bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.10] rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex gap-1 bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.10] rounded-xl p-1">
          {['all', 'active', 'pending', 'suspended'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                filter === f ? 'text-foreground' : 'text-muted-foreground hover:text-muted-foreground'
              }`}
              style={filter === f ? { background: 'var(--theme-primary, #3b82f6)' } : {}}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex-1 max-w-xs">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-9 pr-3 py-2 bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.10] rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border dark:border-white/[0.10]"
            />
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-xl p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-foreground mb-2">Delete User</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete <span className="font-medium text-foreground">{deleteConfirm.email}</span>? This action will remove all sessions and related records. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground bg-muted dark:bg-white/[0.06] hover:bg-muted dark:bg-white/[0.10] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUser(deleteConfirm.id)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 size={14} />
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Panel */}
      {editUser && (
        <div className="bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.10] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Editing: {editUser.name || editUser.email}</h2>
            <button onClick={() => setEditUser(null)} className="p-1 hover:bg-muted dark:bg-white/[0.06] rounded-lg">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Role</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2 bg-muted dark:bg-white/[0.06] border border-border dark:border-white/[0.10] rounded-xl text-foreground focus:outline-none focus:border-border dark:border-white/[0.10] [&>option]:bg-background [&>option]:text-foreground"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
                <option value="superadmin">superadmin</option>
                {roles.filter(r => !['user','admin','superadmin'].includes(r.name)).map((r) => (
                  <option key={r.id} value={r.name}>{r.name}{r.department_name ? ` (${r.department_name})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 bg-muted dark:bg-white/[0.06] border border-border dark:border-white/[0.10] rounded-xl text-foreground focus:outline-none focus:border-border dark:border-white/[0.10] [&>option]:bg-background [&>option]:text-foreground"
              >
                {['active', 'pending', 'suspended', 'disabled'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-foreground transition-opacity disabled:opacity-50"
              style={{ background: 'var(--theme-primary, #3b82f6)' }}
            >
              <Check size={14} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={() => setEditUser(null)} className="px-5 py-2 rounded-xl text-sm font-medium text-muted-foreground bg-muted dark:bg-white/[0.06] hover:bg-muted dark:bg-white/[0.10]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--theme-primary, #3b82f6)', borderTopColor: 'transparent' }} />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16">
          <Users size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No users match your filters</p>
        </div>
      ) : (
        <div className="bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.10] rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_120px_100px_140px_60px] px-5 py-3 bg-muted/50 dark:bg-white/[0.04] border-b border-border dark:border-white/[0.10] text-xs text-muted-foreground uppercase tracking-wider">
            <span>User</span>
            <span>Role</span>
            <span>Status</span>
            <span>Joined</span>
            <span />
          </div>

          {/* User Rows */}
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              className="grid grid-cols-1 sm:grid-cols-[1fr_120px_100px_140px_60px] items-center px-5 py-4 border-b border-border dark:border-white/[0.10] last:border-b-0 hover:bg-muted/50 dark:bg-white/[0.04] transition-colors"
            >
              {/* User info */}
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-foreground shrink-0"
                  style={{ background: `linear-gradient(135deg, var(--theme-primary, #3b82f6), var(--theme-accent, #6366f1))` }}
                >
                  {(u.name || u.email).split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{u.name || 'No name'}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
              </div>

              {/* Role */}
              <div className="mt-2 sm:mt-0">
                <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium ${ROLE_STYLES[u.role] || ROLE_STYLES.user}`}>
                  {u.role}
                </span>
              </div>

              {/* Status */}
              <div className="mt-1 sm:mt-0">
                <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_STYLES[u.status] || STATUS_STYLES.active}`}>
                  {u.status || 'active'}
                </span>
              </div>

              {/* Joined */}
              <p className="text-xs text-muted-foreground mt-1 sm:mt-0">
                {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>

              {/* Actions */}
              <div className="mt-2 sm:mt-0 flex justify-end gap-1">
                <button
                  onClick={() => startEdit(u)}
                  className="p-2 rounded-lg hover:bg-muted dark:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit user"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => setDeleteConfirm(u)}
                  className="p-2 rounded-lg hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors"
                  title="Delete user"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
