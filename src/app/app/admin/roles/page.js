'use client';

/**
 * Admin Roles & Permissions Management
 * Enterprise RBAC with hierarchy levels and comprehensive permission grid
 */

import { useEffect, useState } from 'react';
import { Shield, Plus, X, Check, Trash2, ChevronRight, Lock, Layers, Search, Building2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { confirmDangerous } from '@/lib/confirm';

// Dynamic — no hardcoded hierarchy labels
const getHierarchyLabel = (level) => {
  if (level <= 1) return 'Founder / Super Admin';
  if (level <= 2) return 'Executive Leadership';
  if (level <= 3) return 'Department Lead';
  if (level <= 5) return 'Senior Staff';
  if (level <= 7) return 'Operational Staff';
  if (level <= 10) return 'Limited Access';
  return `Custom Level ${level}`;
};

export default function AdminRolesPage() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({ flat: [], grouped: {} });
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRoleHierarchy, setNewRoleHierarchy] = useState(4);
  const [newRolePerms, setNewRolePerms] = useState([]);
  const [newRoleDepartment, setNewRoleDepartment] = useState('');
  const [newRoleAlias, setNewRoleAlias] = useState('');
  const [newRoleAuthority, setNewRoleAuthority] = useState(20);
  const [saving, setSaving] = useState(false);
  const [editHierarchy, setEditHierarchy] = useState(null);
  const [editAuthority, setEditAuthority] = useState(null);
  const [editDepartment, setEditDepartment] = useState('');
  const [editAlias, setEditAlias] = useState('');
  const [expandedModules, setExpandedModules] = useState({});
  const [departments, setDepartments] = useState([]);
  const [roleSearch, setRoleSearch] = useState('');
  const toast = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rolesRes, permsRes, deptsRes] = await Promise.all([
        fetchWithAuth('/api/admin/roles'),
        fetchWithAuth('/api/admin/permissions'),
        fetch('/api/departments', { credentials: 'include' }),
      ]);
      const rolesData = await rolesRes.json();
      const permsData = await permsRes.json();
      const deptsData = await deptsRes.json();
      if (rolesData.success) setRoles(rolesData.data);
      if (permsData.success) setPermissions({ flat: permsData.data, grouped: permsData.grouped });
      if (deptsData.success) setDepartments(deptsData.data);
    } catch (err) {
      console.error('Failed to fetch roles/permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectRole = async (role) => {
    setSelectedRole(role);
    setShowCreate(false);
    setEditHierarchy(role.hierarchy_level);
    setEditAuthority(role.authority_level ?? 20);
    setEditDepartment(role.department_id || '');
    setEditAlias(role.alias || '');
    try {
      const res = await fetchWithAuth(`/api/admin/roles/${role.id}`);
      const data = await res.json();
      if (data.success) {
        setRolePermissions(data.data.permissions.map((p) => p.id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await fetchWithAuth(`/api/admin/roles/${selectedRole.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission_ids: rolePermissions,
          hierarchy_level: editHierarchy,
          authority_level: editAuthority,
          department_id: editDepartment || null,
          alias: editAlias || null,
        }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoleName.trim().toLowerCase().replace(/\s+/g, '_'),
          description: newRoleDescription.trim() || undefined,
          permissionIds: newRolePerms,
          hierarchy_level: newRoleHierarchy,
          authority_level: newRoleAuthority,
          department_id: newRoleDepartment || null,
          alias: newRoleAlias || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setNewRoleName('');
        setNewRoleDescription('');
        setNewRoleHierarchy(4);
        setNewRolePerms([]);
        setNewRoleDepartment('');
        setNewRoleAlias('');
        setNewRoleAuthority(20);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (roleId) => {
    if (!await confirmDangerous('Users with this role will lose associated permissions.', 'Delete Role')) return;
    try {
      const res = await fetchWithAuth(`/api/admin/roles/${roleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error);
        return;
      }
      if (selectedRole?.id === roleId) setSelectedRole(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const togglePermission = (permId, list, setter) => {
    setter(list.includes(permId) ? list.filter((id) => id !== permId) : [...list, permId]);
  };

  const toggleModule = (modulePerms, list, setter) => {
    const ids = modulePerms.map((p) => p.id);
    const allSelected = ids.every((id) => list.includes(id));
    if (allSelected) {
      setter(list.filter((id) => !ids.includes(id)));
    } else {
      setter([...new Set([...list, ...ids])]);
    }
  };

  const toggleModuleExpand = (module) => {
    setExpandedModules(prev => ({ ...prev, [module]: !prev[module] }));
  };

  const HierarchySelector = ({ value, onChange, disabled }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">Hierarchy Level</label>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={1}
          max={100}
          value={value || 5}
          onChange={e => !disabled && onChange(parseInt(e.target.value) || 5)}
          disabled={disabled}
          className="w-20 px-3 py-2 bg-muted dark:bg-white/[0.06] border border-border dark:border-white/[0.10] rounded-xl text-foreground text-sm focus:outline-none disabled:opacity-50"
        />
        <span className="text-sm text-muted-foreground">{getHierarchyLabel(value || 5)}</span>
        <span className="text-[10px] text-muted-foreground">(1 = highest, used for approval chains)</span>
      </div>
    </div>
  );

  const AuthorityLevelInput = ({ value, onChange, disabled }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">Authority Level</label>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={1}
          max={100}
          value={value || 20}
          onChange={e => !disabled && onChange(parseInt(e.target.value) || 20)}
          disabled={disabled}
          className="w-20 px-3 py-2 bg-muted dark:bg-white/[0.06] border border-border dark:border-white/[0.10] rounded-xl text-foreground text-sm focus:outline-none disabled:opacity-50"
        />
        <span className="text-sm text-muted-foreground">
          {value >= 90 ? 'Superadmin' : value >= 70 ? 'Admin' : value >= 50 ? 'Manager' : value >= 30 ? 'Staff' : 'Viewer'}
        </span>
        <span className="text-[10px] text-muted-foreground">(higher = more authority, controls role assignment)</span>
      </div>
    </div>
  );

  const DepartmentSelector = ({ value, onChange, disabled }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">Department</label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 bg-muted dark:bg-white/[0.06] border border-border dark:border-white/[0.10] rounded-xl text-foreground text-sm focus:outline-none disabled:opacity-50"
      >
        <option value="">No department</option>
        {departments.map(d => <option key={d.id} value={d.id}>{d.name}{d.alias ? ` (${d.alias})` : ''}</option>)}
      </select>
    </div>
  );

  const PermissionGrid = ({ permList, setPerm, isSystem }) => (
    <div className="space-y-2">
      {Object.entries(permissions.grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([module, perms]) => {
          const moduleIds = perms.map((p) => p.id);
          const selectedCount = moduleIds.filter((id) => permList.includes(id)).length;
          const allSelected = selectedCount === moduleIds.length;
          const isExpanded = expandedModules[module] !== false;

          return (
            <div key={module} className="bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.10] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleModuleExpand(module)}
                  className="flex-1 flex items-center gap-2 px-4 py-3 hover:bg-muted/50 dark:hover:bg-white/[0.06] transition-colors text-left"
                >
                  <ChevronRight
                    size={14}
                    className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                  <span className="text-sm font-medium text-foreground capitalize">{module.replace(/_/g, ' ')}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted dark:bg-white/[0.06] text-muted-foreground">
                    {selectedCount}/{moduleIds.length}
                  </span>
                </button>
                <button
                  onClick={() => !isSystem && toggleModule(perms, permList, setPerm)}
                  disabled={isSystem}
                  className="px-4 py-3 disabled:cursor-not-allowed"
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      allSelected
                        ? 'border-transparent'
                        : selectedCount > 0
                          ? 'border-border dark:border-white/20 bg-muted dark:bg-white/[0.10]'
                          : 'border-border dark:border-white/10'
                    }`}
                    style={allSelected ? { background: 'var(--theme-primary, #3b82f6)' } : {}}
                  >
                    {allSelected && <Check size={10} className="text-white" />}
                    {!allSelected && selectedCount > 0 && <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />}
                  </div>
                </button>
              </div>
              {isExpanded && (
                <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {perms.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => !isSystem && togglePermission(p.id, permList, setPerm)}
                      disabled={isSystem}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors text-xs disabled:cursor-not-allowed ${
                        permList.includes(p.id) ? 'bg-muted dark:bg-white/[0.06] text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                          permList.includes(p.id) ? 'border-transparent' : 'border-border dark:border-white/10'
                        }`}
                        style={permList.includes(p.id) ? { background: 'var(--theme-primary, #3b82f6)' } : {}}
                      >
                        {permList.includes(p.id) && <Check size={8} className="text-white" />}
                      </div>
                      <span className="truncate capitalize">{p.action.replace(/_/g, ' ')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--theme-primary, #3b82f6)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground mt-1">{roles.length} roles configured &middot; Enterprise RBAC with hierarchy enforcement</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setSelectedRole(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--theme-primary, #3b82f6)' }}
        >
          <Plus size={16} />
          New Role
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* Role List */}
        <div className="space-y-2">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={roleSearch} onChange={e => setRoleSearch(e.target.value)} placeholder="Search roles..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.10] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
          </div>
          {roles.filter(r => !roleSearch || r.name.includes(roleSearch.toLowerCase()) || r.alias?.toLowerCase().includes(roleSearch.toLowerCase()) || r.department_name?.toLowerCase().includes(roleSearch.toLowerCase())).map((role) => (
            <button
              key={role.id}
              onClick={() => selectRole(role)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left ${
                selectedRole?.id === role.id
                  ? 'bg-muted dark:bg-white/[0.06] border-border dark:border-white/[0.15]'
                  : 'bg-muted/50 dark:bg-white/[0.04] border-border dark:border-white/[0.10] hover:bg-muted dark:hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: role.is_system
                      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                      : 'linear-gradient(135deg, var(--theme-primary, #3b82f6), var(--theme-accent, #6366f1))',
                  }}
                >
                  {role.is_system ? <Lock size={14} className="text-white" /> : <Shield size={14} className="text-white" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground capitalize truncate">{role.name.replace(/_/g, ' ')}{role.alias ? ` (${role.alias})` : ''}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Auth {role.authority_level ?? '?'} &middot; Lvl {role.hierarchy_level || '?'} &middot; {role.permission_count || 0} perms &middot; {role.user_count || 0} users{role.department_name ? ` · ${role.department_name}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!role.is_system && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteRole(role.id); }}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
                <ChevronRight size={14} className="text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>

        {/* Permission Editor */}
        <div>
          {showCreate && (
            <div className="bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.10] rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Create New Role</h2>
                <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted dark:hover:bg-white/[0.06] rounded-lg">
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Role Name</label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. department_manager"
                    className="w-full px-3 py-2 bg-muted dark:bg-white/[0.06] border border-border dark:border-white/[0.10] rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Description</label>
                  <input
                    type="text"
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                    placeholder="Optional description"
                    className="w-full px-3 py-2 bg-muted dark:bg-white/[0.06] border border-border dark:border-white/[0.10] rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <HierarchySelector value={newRoleHierarchy} onChange={setNewRoleHierarchy} />
              <AuthorityLevelInput value={newRoleAuthority} onChange={setNewRoleAuthority} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DepartmentSelector value={newRoleDepartment} onChange={setNewRoleDepartment} />
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Alias (optional)</label>
                  <input value={newRoleAlias} onChange={e => setNewRoleAlias(e.target.value)} placeholder="e.g. Emperor, Prince..."
                    className="w-full px-3 py-2 bg-muted dark:bg-white/[0.06] border border-border dark:border-white/[0.10] rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none text-sm" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3">Module Permissions</h3>
                <PermissionGrid permList={newRolePerms} setPerm={setNewRolePerms} isSystem={false} />
              </div>
              <button
                onClick={createRole}
                disabled={saving || !newRoleName.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ background: 'var(--theme-primary, #3b82f6)' }}
              >
                <Check size={14} />
                {saving ? 'Creating...' : 'Create Role'}
              </button>
            </div>
          )}

          {selectedRole && !showCreate && (
            <div className="bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.10] rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground capitalize">{selectedRole.name.replace(/_/g, ' ')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {selectedRole.description || 'No description'}
                    {selectedRole.alias && ` · Alias: ${selectedRole.alias}`}
                    {selectedRole.department_name && ` · Dept: ${selectedRole.department_name}`}
                    {' · '}
                    <span className="inline-flex items-center gap-1">
                      <Layers size={11} />
                      Authority {selectedRole.authority_level ?? '?'} · Hierarchy {selectedRole.hierarchy_level || '?'} — {getHierarchyLabel(selectedRole.hierarchy_level)}
                    </span>
                  </p>
                  {selectedRole.is_system && (
                    <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                      <Lock size={10} /> System role — permissions are read-only
                    </p>
                  )}
                </div>
                {!selectedRole.is_system && (
                  <button
                    onClick={savePermissions}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                    style={{ background: 'var(--theme-primary, #3b82f6)' }}
                  >
                    <Check size={14} />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </div>
              {!selectedRole.is_system && (
                <HierarchySelector value={editHierarchy} onChange={setEditHierarchy} disabled={selectedRole.is_system} />
              )}
              {!selectedRole.is_system && (
                <AuthorityLevelInput value={editAuthority} onChange={setEditAuthority} disabled={selectedRole.is_system} />
              )}
              {!selectedRole.is_system && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DepartmentSelector value={editDepartment} onChange={setEditDepartment} disabled={selectedRole.is_system} />
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Alias (optional)</label>
                    <input
                      value={editAlias}
                      onChange={e => setEditAlias(e.target.value)}
                      placeholder="e.g. Emperor, Prince..."
                      className="w-full px-3 py-2 bg-muted dark:bg-white/[0.06] border border-border dark:border-white/[0.10] rounded-xl text-foreground text-sm focus:outline-none"
                    />
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3">Module Permissions</h3>
                <PermissionGrid
                  permList={rolePermissions}
                  setPerm={setRolePermissions}
                  isSystem={selectedRole.is_system}
                />
              </div>
            </div>
          )}

          {!selectedRole && !showCreate && (
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
              <Shield size={48} className="text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-sm">Select a role to view and edit its permissions</p>
              <p className="text-muted-foreground text-xs mt-1">Or create a new custom role with hierarchy level</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
