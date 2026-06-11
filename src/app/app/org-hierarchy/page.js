'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, Search, Plus, Edit2, Trash2, X, Check, User, Network } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

/**
 * Organization Structure — Interactive Hierarchy Visualization
 * Full CRUD, zoomable tree, search, color-coded authority, mobile-responsive
 */

export default function OrgHierarchyPage() {
  const [nodes, setNodes] = useState([]);
  const [tree, setTree] = useState([]);
  const [authorityLevels, setAuthorityLevels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editNode, setEditNode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ node_name: '', department_id: '', role_id: '', authority_level_id: '', reports_to_node_id: '', staff_assigned_id: '', title_alias: '', status: 'vacant' });
  const toast = useToast();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [structRes, authRes, deptRes, roleRes, userRes] = await Promise.all([
        fetchWithAuth('/api/org/structure').then(r => r.json()),
        fetchWithAuth('/api/admin/authority-levels').then(r => r.json()),
        fetch('/api/departments', { credentials: 'include' }).then(r => r.json()),
        fetchWithAuth('/api/admin/roles').then(r => r.json()),
        fetchWithAuth('/api/staff').then(r => r.json()),
      ]);
      if (structRes.success) {
        setNodes(structRes.data || []);
        setTree(structRes.tree || []);
        const exp = {};
        (structRes.data || []).forEach(n => { if (n.hierarchy_depth < 2) exp[n.id] = true; });
        setExpanded(exp);
      }
      if (authRes.success) setAuthorityLevels(authRes.data || []);
      if (deptRes.success) setDepartments(deptRes.data || []);
      if (roleRes.success) setRoles(roleRes.data || []);
      if (userRes.success) setUsers(userRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const expandAll = () => { const e = {}; nodes.forEach(n => e[n.id] = true); setExpanded(e); };
  const collapseAll = () => setExpanded({});

  const resetForm = () => setForm({ node_name: '', department_id: '', role_id: '', authority_level_id: '', reports_to_node_id: '', staff_assigned_id: '', title_alias: '', status: 'vacant' });

  const openCreate = (parentId) => {
    resetForm();
    if (parentId) setForm(f => ({ ...f, reports_to_node_id: parentId }));
    setEditNode(null);
    setShowCreate(true);
  };

  const openEdit = (node) => {
    setForm({
      node_name: node.node_name || '',
      department_id: node.department_id || '',
      role_id: node.role_id || '',
      authority_level_id: node.authority_level_id || '',
      reports_to_node_id: node.reports_to_node_id || '',
      staff_assigned_id: node.staff_assigned_id || '',
      title_alias: node.title_alias || '',
      status: node.status || 'active',
    });
    setEditNode(node);
    setShowCreate(true);
  };

  const saveNode = async () => {
    if (!form.node_name.trim()) return;
    setSaving(true);
    try {
      const url = editNode ? `/api/org/structure/${editNode.id}` : '/api/org/structure';
      const method = editNode ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editNode ? 'Node updated' : 'Node created');
        setShowCreate(false);
        setEditNode(null);
        fetchData();
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteNode = async (id, name) => {
    if (!confirm(`Archive "${name}"? Children must be reassigned first.`)) return;
    try {
      const res = await fetchWithAuth(`/api/org/structure/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Node archived');
        fetchData();
      } else {
        toast.error(data.error);
      }
    } catch { toast.error('Delete failed'); }
  };

  const matchesSearch = (node) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (node.node_name?.toLowerCase().includes(q) ||
            node.staff_name?.toLowerCase().includes(q) ||
            node.department_name?.toLowerCase().includes(q) ||
            node.role_name?.toLowerCase().includes(q) ||
            node.title_alias?.toLowerCase().includes(q));
  };

  const filterTree = (treeNodes) => {
    if (!search) return treeNodes;
    return treeNodes.reduce((acc, node) => {
      const filteredChildren = filterTree(node.children || []);
      if (matchesSearch(node) || filteredChildren.length > 0) {
        acc.push({ ...node, children: filteredChildren });
      }
      return acc;
    }, []);
  };

  const statusColor = (s) => {
    if (s === 'active') return 'bg-emerald-500';
    if (s === 'vacant') return 'bg-amber-500';
    if (s === 'suspended') return 'bg-red-500';
    return 'bg-gray-400';
  };

  const TreeNode = ({ node, depth = 0 }) => {
    const isOpen = expanded[node.id];
    const hasChildren = node.children?.length > 0;
    const color = node.color_indicator || '#6b7280';

    return (
      <div className={depth > 0 ? 'ml-4 sm:ml-6 border-l border-border pl-3 sm:pl-4' : ''}>
        <div className="group flex items-center gap-2 py-2 px-2 sm:px-3 rounded-lg hover:bg-muted/50 transition">
          <button onClick={() => toggle(node.id)} className="w-5 h-5 flex items-center justify-center shrink-0" disabled={!hasChildren}>
            {hasChildren ? (isOpen ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />) : <span className="w-3.5" />}
          </button>
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} title={node.authority_level_name || 'No level'} />
          <div className={`w-2 h-2 rounded-full shrink-0 ${statusColor(node.status)}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground truncate">{node.title_alias || node.node_name}</span>
              {node.title_alias && <span className="text-[10px] text-muted-foreground">({node.node_name})</span>}
              {node.authority_level_name && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium text-white shrink-0" style={{ backgroundColor: color }}>
                  {node.authority_level_name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
              {node.staff_name && <span className="flex items-center gap-0.5"><User size={10} />{node.staff_name}</span>}
              {node.department_name && <span>· {node.department_name}</span>}
              {node.role_name && <span>· {node.role_name}</span>}
              {!node.staff_name && node.status === 'vacant' && <span className="text-amber-500 font-medium">Vacant</span>}
            </div>
          </div>
          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            <button onClick={() => openCreate(node.id)} className="p-1 rounded hover:bg-muted" title="Add child"><Plus size={13} className="text-muted-foreground" /></button>
            <button onClick={() => openEdit(node)} className="p-1 rounded hover:bg-muted" title="Edit"><Edit2 size={13} className="text-muted-foreground" /></button>
            <button onClick={() => deleteNode(node.id, node.node_name)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20" title="Archive"><Trash2 size={13} className="text-red-400" /></button>
          </div>
        </div>
        {isOpen && hasChildren && node.children.map(child => (
          <TreeNode key={child.id} node={child} depth={depth + 1} />
        ))}
      </div>
    );
  };

  const filteredTree = filterTree(tree);
  const stats = {
    total: nodes.length,
    active: nodes.filter(n => n.status === 'active').length,
    vacant: nodes.filter(n => n.status === 'vacant').length,
    suspended: nodes.filter(n => n.status === 'suspended').length,
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--theme-primary, #3b82f6)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Network size={22} style={{ color: 'var(--theme-primary, #3b82f6)' }} />
            Organization Structure
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {stats.total} positions · <span className="text-emerald-500">{stats.active} active</span> · <span className="text-amber-500">{stats.vacant} vacant</span>{stats.suspended > 0 && <> · <span className="text-red-500">{stats.suspended} suspended</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, role, dept..."
              className="pl-8 pr-3 py-2 border border-border rounded-xl bg-background text-foreground text-sm w-48 sm:w-56 focus:outline-none" />
          </div>
          <button onClick={expandAll} className="px-3 py-2 text-xs border border-border rounded-xl hover:bg-muted text-muted-foreground">Expand</button>
          <button onClick={collapseAll} className="px-3 py-2 text-xs border border-border rounded-xl hover:bg-muted text-muted-foreground">Collapse</button>
          <button onClick={() => openCreate(null)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white hover:opacity-90" style={{ background: 'var(--theme-primary, #3b82f6)' }}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {/* Authority Legend */}
      <div className="flex flex-wrap gap-2">
        {authorityLevels.map(al => (
          <span key={al.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: al.color_indicator }} />
            {al.name} ({al.rank_value})
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px]"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Active</span>
        <span className="flex items-center gap-1.5 text-[11px]"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Vacant</span>
        <span className="flex items-center gap-1.5 text-[11px]"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /> Suspended</span>
      </div>

      {/* Tree */}
      <div className="bg-card border border-border rounded-xl p-3 sm:p-5 overflow-x-auto">
        {filteredTree.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {search ? 'No nodes match your search.' : 'No organizational structure defined yet. Click "Add" to start.'}
          </div>
        ) : filteredTree.map(root => <TreeNode key={root.id} node={root} />)}
      </div>

      {/* Create/Edit Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowCreate(false); setEditNode(null); }}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">{editNode ? 'Edit Node' : 'Create Node'}</h2>
              <button onClick={() => { setShowCreate(false); setEditNode(null); }} className="p-1 hover:bg-muted rounded-lg"><X size={18} className="text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Position Name *</label>
                <input value={form.node_name} onChange={e => setForm(f => ({ ...f, node_name: e.target.value }))} placeholder="e.g. Chief Technology Officer"
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-foreground text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Title Alias (display override)</label>
                <input value={form.title_alias} onChange={e => setForm(f => ({ ...f, title_alias: e.target.value }))} placeholder="e.g. Emperor, Chief Visionary Officer..."
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-foreground text-sm focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Authority Level</label>
                  <select value={form.authority_level_id} onChange={e => setForm(f => ({ ...f, authority_level_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-foreground text-sm focus:outline-none">
                    <option value="">Select...</option>
                    {authorityLevels.map(al => <option key={al.id} value={al.id}>{al.name} ({al.rank_value})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-foreground text-sm focus:outline-none">
                    <option value="active">Active</option>
                    <option value="vacant">Vacant</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Department</label>
                  <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-foreground text-sm focus:outline-none">
                    <option value="">None</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name || d.department_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Role</label>
                  <select value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-foreground text-sm focus:outline-none">
                    <option value="">None</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}{r.alias ? ` (${r.alias})` : ''}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Reports To</label>
                  <select value={form.reports_to_node_id} onChange={e => setForm(f => ({ ...f, reports_to_node_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-foreground text-sm focus:outline-none">
                    <option value="">None (root)</option>
                    {nodes.filter(n => n.id !== editNode?.id).map(n => <option key={n.id} value={n.id}>{n.node_name}{n.authority_level_name ? ` — ${n.authority_level_name}` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Assigned Staff</label>
                  <select value={form.staff_assigned_id} onChange={e => setForm(f => ({ ...f, staff_assigned_id: e.target.value, status: e.target.value ? 'active' : form.status }))}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-foreground text-sm focus:outline-none">
                    <option value="">Vacant</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={saveNode} disabled={saving || !form.node_name.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
                style={{ background: 'var(--theme-primary, #3b82f6)' }}>
                <Check size={14} />{saving ? 'Saving...' : editNode ? 'Update Node' : 'Create Node'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
