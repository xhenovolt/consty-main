'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Users, Trash2, X, ChevronRight, Building2, Pencil, Search, Shield, Circle, UserPlus, UserCheck, Lock, Eye, EyeOff, Key } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';
import { usePermissions } from '@/components/providers/PermissionProvider';

// ─── Create Account Modal ────────────────────────────────────────────────────
function CreateAccountModal({ staff, onClose, onSuccess }) {
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter',  met: /[A-Z]/.test(password) },
    { label: 'One number',            met: /[0-9]/.test(password) },
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/admin/staff/${staff.id}/create-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to create account');
      } else {
        onSuccess(data.user);
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-foreground">Create User Account</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">
          <p className="text-sm text-muted-foreground mb-4">
            Creating account for <span className="font-medium text-foreground">{staff.name}</span>.
            They will be prompted to set a permanent password on first login.
          </p>
          {staff.email && (
            <p className="text-xs bg-muted rounded-lg px-3 py-2 mb-4">
              <span className="text-muted-foreground">Login email: </span>
              <span className="font-medium text-foreground">{staff.email}</span>
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Username *</label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                required minLength={3}
                placeholder="e.g. john.doe"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Temporary Password *</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required minLength={8}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-10 border border-border rounded-lg bg-background text-foreground"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password && (
                <ul className="mt-2 space-y-1">
                  {requirements.map(r => (
                    <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.met ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      <span className={`w-3 h-3 rounded-full border flex-shrink-0 ${r.met ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40'}`} />
                      {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">
                Cancel
              </button>
              <button type="submit" disabled={saving || requirements.some(r => !r.met)}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const ACCOUNT_STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-amber-100 text-amber-700',
  terminated: 'bg-red-100 text-red-700',
};

const WORK_STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-muted text-muted-foreground',
  contractor: 'bg-blue-100 text-blue-700',
  probation: 'bg-yellow-100 text-yellow-700',
};

const PRESENCE_DOT = {
  online: 'bg-emerald-500',
  away: 'bg-amber-400',
  offline: 'bg-gray-400',
};

const PRESENCE_LABEL = { online: 'Online', away: 'Away', offline: 'Offline' };

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const [presenceMap, setPresenceMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [tab, setTab] = useState('list');
  const [deptFilter, setDeptFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [roleFilterText, setRoleFilterText] = useState('');
  const roleDropdownRef = useRef(null);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', department: '', department_id: '', position: '',
    salary: '', salary_currency: 'UGX', salary_account_id: '', manager_id: '',
    hire_date: '', status: 'active', account_status: 'active', notes: '',
  });
  // User-account fields (only for new staff, not edit)
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const presenceInterval = useRef(null);
  // Account creation modal
  const [createAccountFor, setCreateAccountFor] = useState(null);
  const { user: currentUser } = usePermissions();

  // Fetch all RBAC roles dynamically
  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/admin/roles');
      const j = await res.json();
      if (j.success) setAllRoles(j.data || []);
    } catch {}
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/departments');
      const j = await res.json();
      if (j.success) setDepartments(j.data || []);
    } catch {}
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await fetchWithAuth('/api/staff');
      const j = await res.json();
      if (j.success) {
        const data = j.data || [];
        // Build presence map from staff data (presence_status is included)
        const pMap = {};
        data.forEach(s => {
          if (s.email) pMap[s.email] = { status: s.presence_status || 'offline', last_seen_at: s.last_seen_at };
        });
        setPresenceMap(prev => ({ ...prev, ...pMap }));
        setStaff(data);
      }
    } catch {} finally { setLoading(false); }
  };

  // Lightweight presence refresh (only presence data, not full staff)
  const refreshPresence = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/users/presence');
      const j = await res.json();
      if (j.success && j.data) {
        const pMap = {};
        j.data.forEach(p => { if (p.email) pMap[p.email] = { status: p.status, last_seen_at: p.last_seen }; });
        setPresenceMap(pMap);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchStaff();
    fetchDepartments();
    fetchRoles();
    fetchWithAuth('/api/accounts').then(r => r.json()).then(j => { if (j.success) setAccounts(j.data || []); }).catch(() => {});

    // Refresh presence every 30 seconds
    presenceInterval.current = setInterval(refreshPresence, 30000);
    return () => { if (presenceInterval.current) clearInterval(presenceInterval.current); };
  }, [fetchDepartments, fetchRoles, refreshPresence]);

  // Close role dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) setRoleDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const resetForm = () => {
    setForm({ name: '', email: '', phone: '', department: '', department_id: '', position: '', salary: '', salary_currency: 'UGX', salary_account_id: '', manager_id: '', hire_date: '', status: 'active', account_status: 'active', notes: '' });
    setSelectedRoleIds([]);
    setRoleFilterText('');
    setNewUsername('');
    setNewPassword('');
    setShowNewPassword(false);
  };

  const submit = async (e) => {
    e.preventDefault();

    // For new staff, validate user account fields before submitting
    if (!editId) {
      if (!newUsername.trim() || newUsername.trim().length < 3) {
        toast.error('Username must be at least 3 characters');
        return;
      }
      if (!newPassword || newPassword.length < 8) {
        toast.error('Temporary password must be at least 8 characters');
        return;
      }
      if (selectedRoleIds.length === 0) {
        toast.error('Please select at least one role');
        return;
      }
      if (!form.department_id) {
        toast.error('Department is required');
        return;
      }
    }

    setSaving(true);
    try {
      const body = { ...form };
      // role_id from first selected role
      if (selectedRoleIds.length > 0) body.role_id = selectedRoleIds[0];
      if (body.salary) body.salary = parseFloat(body.salary);
      else delete body.salary;
      Object.keys(body).forEach(k => { if (body[k] === '') delete body[k]; });
      if (editId) body.id = editId;

      // Attach user account fields for new staff creation
      if (!editId) {
        body.username = newUsername.trim().toLowerCase();
        body.password = newPassword;
      }

      const method = editId ? 'PATCH' : 'POST';
      const res = await fetchWithAuth('/api/staff', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await res.json();
      if (result.success) {
        const staffId = editId || result.data?.id;
        // For edits, sync roles via staff_roles
        if (editId && staffId && selectedRoleIds.length >= 0) {
          try {
            await fetchWithAuth(`/api/admin/staff/${staffId}/roles`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role_ids: selectedRoleIds }),
            });
          } catch {}
        }
        const msg = editId
          ? 'Staff updated'
          : `Staff added. Login username: ${result.user?.username || newUsername}`;
        toast.success(msg);
        setShowForm(false);
        setEditId(null);
        resetForm();
        fetchStaff();
      } else {
        toast.error(result.error || 'Failed to save');
      }
    } catch (err) { toast.error('Failed to save'); console.error(err); } finally { setSaving(false); }
  };

  const startEdit = async (s) => {
    setForm({
      name: s.name || '', email: s.email || '', phone: s.phone || '',
      department: s.department || s.dept_name || '', department_id: s.department_id || '',
      position: s.position || '', salary: s.salary?.toString() || '',
      salary_currency: s.salary_currency || 'UGX', salary_account_id: s.salary_account_id || '',
      manager_id: s.manager_id || '', hire_date: s.hire_date?.split('T')[0] || '',
      status: s.status || 'active', account_status: s.account_status || 'active', notes: s.notes || '',
    });
    // Load assigned roles
    const roles = s.assigned_roles || [];
    setSelectedRoleIds(roles.map(r => r.id));
    setEditId(s.id);
    setShowForm(true);
  };

  const deleteStaff = async (id) => {
    if (!await confirmDelete('team member')) return;
    try {
      await fetchWithAuth(`/api/staff?id=${id}`, { method: 'DELETE' });
      toast.success('Team member removed');
      fetchStaff();
    } catch { toast.error('Failed to delete'); }
  };

  const getPresence = (s) => {
    if (s.email && presenceMap[s.email]) return presenceMap[s.email].status;
    return s.presence_status || 'offline';
  };

  // Whether the current user can create linked accounts
  const canCreateAccounts = currentUser?.is_superadmin ||
    (currentUser?.authority_level ?? 0) >= 80;

  // Determine if a staff member has a linked user account
  const hasLinkedUser = (s) => !!(s.linked_user_id || s.user_id);

  // Filtering
  const filtered = staff.filter(s => {
    if (deptFilter && s.department !== deptFilter && s.dept_name !== deptFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameMatch = s.name?.toLowerCase().includes(q);
      const emailMatch = s.email?.toLowerCase().includes(q);
      const roleMatch = (s.assigned_roles || []).some(r => r.name?.toLowerCase().includes(q));
      const deptMatch = (s.dept_name || s.department || '').toLowerCase().includes(q);
      if (!nameMatch && !emailMatch && !roleMatch && !deptMatch) return false;
    }
    return true;
  });

  // Build hierarchy tree
  const buildTree = () => {
    const map = {};
    staff.forEach(s => { map[s.id] = { ...s, children: [] }; });
    const roots = [];
    staff.forEach(s => {
      if (s.manager_id && map[s.manager_id]) map[s.manager_id].children.push(map[s.id]);
      else roots.push(map[s.id]);
    });
    return roots;
  };

  const PresenceDot = ({ status, size = 'w-2.5 h-2.5' }) => (
    <span className={`${size} rounded-full inline-block shrink-0 ${PRESENCE_DOT[status] || PRESENCE_DOT.offline}`}
      title={PRESENCE_LABEL[status] || 'Offline'} />
  );

  const TreeNode = ({ node, depth = 0 }) => {
    const presence = getPresence(node);
    return (
      <div style={{ marginLeft: Math.min(depth * 24, 120) }} className="py-2">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          {depth > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          <PresenceDot status={presence} />
          <span className="font-medium text-foreground">{node.name}</span>
          {node.position && <span className="text-muted-foreground">— {node.position}</span>}
          {node.department && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs dark:bg-blue-900/30 dark:text-blue-300">{node.department}</span>}
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${WORK_STATUS_STYLES[node.status] || 'bg-muted text-foreground'}`}>{node.status}</span>
        </div>
        {node.children.map(c => <TreeNode key={c.id} node={c} depth={depth + 1} />)}
      </div>
    );
  };

  // Role multi-select helpers
  const filteredRoles = allRoles.filter(r =>
    !roleFilterText || r.name?.toLowerCase().includes(roleFilterText.toLowerCase()) ||
    r.department_name?.toLowerCase().includes(roleFilterText.toLowerCase())
  );

  const toggleRole = (roleId) => {
    setSelectedRoleIds(prev =>
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  const selectedRoleNames = allRoles.filter(r => selectedRoleIds.includes(r.id)).map(r => r.name);

  // Presence counts
  const onlineCount = staff.filter(s => getPresence(s) === 'online').length;
  const awayCount = staff.filter(s => getPresence(s) === 'away').length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {staff.length} members · {staff.filter(s => s.status === 'active').length} active
            {onlineCount > 0 && <> · <span className="text-emerald-600">{onlineCount} online</span></>}
            {awayCount > 0 && <> · <span className="text-amber-600">{awayCount} away</span></>}
          </p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); resetForm(); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {showForm ? 'Cancel' : 'Add Member'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button onClick={() => setTab('list')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground'}`}>
          <Users className="w-4 h-4 inline mr-1" />List
        </button>
        <button onClick={() => setTab('hierarchy')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'hierarchy' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground'}`}>
          <Building2 className="w-4 h-4 inline mr-1" />Hierarchy
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">{editId ? 'Edit' : 'Add'} Team Member</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Email {!editId && <span className="text-red-500">*</span>}</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required={!editId} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Department</label>
              <select value={form.department_id} onChange={e => {
                const dept = departments.find(d => d.id === e.target.value);
                setForm(f => ({ ...f, department_id: e.target.value, department: dept?.name || '' }));
              }} required={!editId} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                <option value="">Select department...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {/* Multi-role searchable dropdown */}
            <div className="relative md:col-span-2" ref={roleDropdownRef}>
              <label className="block text-sm text-muted-foreground mb-1">
                Roles {!editId && <span className="text-red-500">*</span>} <span className="text-xs text-muted-foreground">(from RBAC)</span>
              </label>
              <div
                className="w-full min-h-[42px] px-3 py-2 border border-border rounded-lg bg-background text-foreground cursor-pointer flex flex-wrap gap-1 items-center"
                onClick={() => setRoleDropdownOpen(true)}
              >
                {selectedRoleNames.length === 0 && <span className="text-muted-foreground text-sm">Select roles...</span>}
                {selectedRoleNames.map(name => (
                  <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium dark:bg-blue-900/30 dark:text-blue-300">
                    {name}
                    <button type="button" onClick={(e) => { e.stopPropagation(); const r = allRoles.find(rl => rl.name === name); if (r) toggleRole(r.id); }}
                      className="hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
              {roleDropdownOpen && (
                <div className="absolute z-30 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-56 overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-border">
                    <div className="relative">
                      <input value={roleFilterText} onChange={e => setRoleFilterText(e.target.value)}
                        placeholder="Search roles..." autoFocus
                        className="w-full px-3 py-1.5 border border-border rounded bg-background text-foreground text-sm pr-8" />
                      <Search className="w-4 h-4 absolute right-2 top-2 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {filteredRoles.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3 text-center">No roles found</p>
                    ) : filteredRoles.map(r => (
                      <button key={r.id} type="button" onClick={() => toggleRole(r.id)}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-muted/50 ${selectedRoleIds.includes(r.id) ? 'bg-blue-50' : ''}`}>
                        <span className="flex items-center gap-2">
                          <input type="checkbox" checked={selectedRoleIds.includes(r.id)} readOnly className="rounded border-border" />
                          <span className="text-foreground">{r.name}</span>
                          {r.alias && <span className="text-xs text-muted-foreground">({r.alias})</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {r.department_name && <>{r.department_name} · </>}
                          L{r.authority_level || 0}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Account — required for new staff, hidden on edit */}
            {!editId && (
              <>
                <div className="md:col-span-3 pt-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <Lock className="w-3.5 h-3.5" />
                    <span>User Account (required)</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Staff must have a login account. They will be prompted to set a permanent password on first login.</p>
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Username <span className="text-red-500">*</span></label>
                  <input
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value.replace(/[^a-z0-9._-]/gi, '').toLowerCase())}
                    required minLength={3} placeholder="e.g. john.doe"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-muted-foreground mb-1">Temporary Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required minLength={8} placeholder="Min 8 characters"
                      className="w-full px-3 py-2 pr-10 border border-border rounded-lg bg-background text-foreground"
                    />
                    <button type="button" onClick={() => setShowNewPassword(v => !v)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPassword && (
                    <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                      {[
                        { label: 'At least 8 characters', met: newPassword.length >= 8 },
                        { label: 'One uppercase letter',  met: /[A-Z]/.test(newPassword) },
                        { label: 'One number',            met: /[0-9]/.test(newPassword) },
                      ].map(r => (
                        <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.met ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          <span className={`w-3 h-3 rounded-full border flex-shrink-0 ${r.met ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40'}`} />
                          {r.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="block text-sm text-muted-foreground mb-1">Position Title</label>
              <input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="e.g. Software Engineer" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Reports To</label>
              <select value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                <option value="">No manager (top-level)</option>
                {staff.filter(s => s.id !== editId).map(s => <option key={s.id} value={s.id}>{s.name}{s.position ? ` — ${s.position}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Salary</label>
              <div className="flex gap-2">
                <select value={form.salary_currency} onChange={e => setForm(f => ({ ...f, salary_currency: e.target.value }))} className="w-20 px-2 py-2 border border-border rounded-lg bg-background text-foreground text-sm">
                  <option value="UGX">UGX</option><option value="USD">USD</option>
                </select>
                <input type="number" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} placeholder="Monthly" className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Salary Account</label>
              <select value={form.salary_account_id} onChange={e => setForm(f => ({ ...f, salary_account_id: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                <option value="">None</option>
                {accounts.filter(a => a.type === 'salary').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Hire Date</label>
              <input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Work Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                {['active', 'inactive', 'contractor', 'probation'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Account Status</label>
              <select value={form.account_status} onChange={e => setForm(f => ({ ...f, account_status: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                {['active', 'suspended', 'terminated'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-muted-foreground mb-1">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : editId ? 'Update' : 'Add Member'}</button>
        </form>
      )}

      {/* Filters & Search */}
      {tab === 'list' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search name, email, role, dept..."
              className="w-full px-3 py-2 pl-9 border border-border rounded-lg bg-background text-foreground text-sm" />
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setDeptFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!deptFilter ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}>All</button>
            {departments.map(d => {
              const count = staff.filter(s => s.department === d.name || s.dept_name === d.name).length;
              if (count === 0) return null;
              return <button key={d.id} onClick={() => setDeptFilter(d.name)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${deptFilter === d.name ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}>{d.name} ({count})</button>;
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : tab === 'hierarchy' ? (
        <div className="bg-card rounded-xl border p-5">
          <h2 className="font-semibold text-foreground mb-4">Organization Hierarchy</h2>
          {staff.length === 0 ? <p className="text-muted-foreground text-sm text-center py-8">No team members</p> : (
            buildTree().map(node => <TreeNode key={node.id} node={node} />)
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No team members found.</div>
      ) : (
        <div className="bg-card rounded-xl border divide-y divide-border">
          {filtered.map(s => {
            const presence = getPresence(s);
            const roles = s.assigned_roles || [];
            const linked = hasLinkedUser(s);
            return (
              <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-muted/50 transition gap-2">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm dark:bg-blue-900/30 dark:text-blue-300">
                      {s.name?.charAt(0)}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${PRESENCE_DOT[presence]}`}
                      title={PRESENCE_LABEL[presence]} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{s.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${WORK_STATUS_STYLES[s.status] || 'bg-muted text-foreground'}`}>{s.status}</span>
                      {s.account_status && s.account_status !== 'active' && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACCOUNT_STATUS_STYLES[s.account_status]}`}>{s.account_status}</span>
                      )}
                      {/* Linked account indicator */}
                      {linked ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-medium dark:bg-emerald-900/30 dark:text-emerald-300" title="Has linked user account">
                          <UserCheck className="w-2.5 h-2.5" />Account linked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-medium dark:bg-amber-900/30 dark:text-amber-300" title="No user account linked">
                          <UserPlus className="w-2.5 h-2.5" />No account
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {s.position || s.role_name || (roles.length > 0 ? roles.map(r => r.name).join(', ') : 'No role')}
                      {(s.dept_name || s.department) && ` · ${s.dept_name || s.department}`}
                      {s.email && <span className="hidden sm:inline"> · {s.email}</span>}
                      {s.manager_name && <span className="hidden md:inline"> · Reports to: {s.manager_name}</span>}
                    </div>
                    {roles.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {roles.map(r => (
                          <span key={r.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded text-[10px] font-medium dark:bg-violet-900/30 dark:text-violet-300">
                            <Shield className="w-2.5 h-2.5" />{r.name}
                            {r.authority_level && <span className="opacity-60">·{r.authority_level}</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.salary && <span className="text-sm font-medium text-foreground whitespace-nowrap">{s.salary_currency || 'UGX'} {Math.round(parseFloat(s.salary)).toLocaleString()}/mo</span>}
                  {/* Create Account button — only shown when no linked account and viewer has authority */}
                  {!linked && canCreateAccounts && (
                    <button
                      onClick={() => setCreateAccountFor(s)}
                      title="Create user account for this staff member"
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/20"
                    >
                      <Key className="w-3.5 h-3.5" />Create Account
                    </button>
                  )}
                  <button onClick={() => startEdit(s)} className="p-1.5 rounded hover:bg-muted"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                  <button onClick={() => deleteStaff(s.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Account Modal */}
      {createAccountFor && (
        <CreateAccountModal
          staff={createAccountFor}
          onClose={() => setCreateAccountFor(null)}
          onSuccess={() => {
            toast.success(`Account created for ${createAccountFor.name}. They must set a password on first login.`);
            setCreateAccountFor(null);
            fetchStaff();
          }}
        />
      )}
    </div>
  );
}
