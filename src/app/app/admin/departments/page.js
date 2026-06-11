'use client';

import { useEffect, useState, useCallback } from 'react';
import { Building2, Plus, X, Edit3, Trash2, Users, FileText, Target, Workflow, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', alias: '', color: '#3b82f6' });
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const toast = useToast();

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch(`/api/departments?active_only=false&search=${search}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setDepartments(data.data);
    } catch {} finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  const selectDept = async (dept) => {
    setSelected(dept);
    setShowCreate(false);
    setActiveTab('overview');
    try {
      const res = await fetch(`/api/departments/${dept.id}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setDetail(data.data);
    } catch {}
  };

  const createDepartment = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/departments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) { toast.success(`Department "${form.name}" created`); setShowCreate(false); setForm({ name: '', description: '', alias: '', color: '#3b82f6' }); fetchDepartments(); }
      else toast.error(data.error);
    } catch { toast.error('Failed to create department'); }
    finally { setSaving(false); }
  };

  const updateDepartment = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/departments/${editingId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) { toast.success('Department updated'); setEditingId(null); fetchDepartments(); if (selected?.id === editingId) selectDept({ id: editingId }); }
      else toast.error(data.error);
    } catch { toast.error('Failed to update'); }
    finally { setSaving(false); }
  };

  const deleteDepartment = async (id, name) => {
    if (!await confirmDelete(name)) return;
    try {
      // First attempt — server will block if staff exist
      const res = await fetch(`/api/departments/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();

      if (data.success) {
        toast.success('Deleted');
        if (selected?.id === id) { setSelected(null); setDetail(null); }
        fetchDepartments();
        return;
      }

      // Handle the staff-exists warning (409)
      if (data.requires_confirmation && data.staff_count > 0) {
        const confirmed = window.confirm(
          `⚠️ Warning: This department has ${data.staff_count} active staff member${data.staff_count !== 1 ? 's' : ''}.\n\n` +
          `Deleting it will not remove the staff, but they will lose their department assignment.\n\n` +
          `Continue anyway?`
        );
        if (!confirmed) return;
        // Force delete
        const forceRes = await fetch(`/api/departments/${id}?force=true`, { method: 'DELETE', credentials: 'include' });
        const forceData = await forceRes.json();
        if (forceData.success) {
          toast.success('Department deactivated');
          if (selected?.id === id) { setSelected(null); setDetail(null); }
          fetchDepartments();
        } else {
          toast.error(forceData.error);
        }
      } else {
        toast.error(data.error);
      }
    } catch { toast.error('Failed to delete'); }
  };

  const startEdit = (dept) => {
    setEditingId(dept.id);
    setForm({ name: dept.name, description: dept.description || '', alias: dept.alias || '', color: dept.color || '#3b82f6' });
    setShowCreate(true);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'roles', label: 'Roles', icon: Users },
    { id: 'policies', label: 'Policies', icon: FileText },
    { id: 'kpis', label: 'KPIs', icon: Target },
    { id: 'processes', label: 'Processes', icon: Workflow },
    { id: 'staff', label: 'Staff', icon: Users },
  ];

  // Mobile: back to list
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'detail' | 'create'

  const selectDeptMobile = async (dept) => {
    await selectDept(dept);
    setMobileView('detail');
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading departments...</div>;

  return (
    <div className="flex flex-col md:flex-row h-auto md:h-[calc(100vh-4rem)]">
      {/* Sidebar — Department List (always visible on desktop, conditional on mobile) */}
      <div className={`w-full md:w-80 border-b md:border-b-0 md:border-r border-border dark:border-white/[0.08] flex flex-col bg-background ${mobileView !== 'list' ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-border dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Building2 size={18} /> Departments
            </h1>
            <button onClick={() => { setShowCreate(true); setEditingId(null); setForm({ name: '', description: '', alias: '', color: '#3b82f6' }); setMobileView('create'); }}
              className="p-1.5 rounded-lg text-white" style={{ background: 'var(--theme-primary, #3b82f6)' }}>
              <Plus size={14} />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search departments..."
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.10] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {departments.map(dept => (
            <div key={dept.id} onClick={() => { if (window.innerWidth < 768) selectDeptMobile(dept); else selectDept(dept); }}
              className={`group px-4 py-3 border-b border-border/50 dark:border-white/[0.04] cursor-pointer hover:bg-muted/50 dark:hover:bg-white/[0.04] transition-colors ${selected?.id === dept.id ? 'bg-muted dark:bg-white/[0.06]' : ''}`}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: dept.color || '#3b82f6' }} />
                <span className="font-medium text-sm text-foreground flex-1">{dept.name}</span>
                {!dept.is_active && <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 rounded">Inactive</span>}
                <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                  <button onClick={e => { e.stopPropagation(); startEdit(dept); if (window.innerWidth < 768) setMobileView('create'); }} className="p-1 rounded hover:bg-muted dark:hover:bg-white/[0.06]"><Edit3 size={12} className="text-muted-foreground" /></button>
                  <button onClick={e => { e.stopPropagation(); deleteDepartment(dept.id, dept.name); }} className="p-1 rounded hover:bg-red-500/10"><Trash2 size={12} className="text-red-400" /></button>
                </div>
              </div>
              {dept.alias && <span className="text-[10px] text-muted-foreground ml-5">{dept.alias}</span>}
              <div className="flex gap-3 mt-1 ml-5 text-[10px] text-muted-foreground">
                <span>{dept.staff_count || 0} staff</span>
                <span>{dept.role_count || 0} roles</span>
                <span>{dept.policy_count || 0} policies</span>
              </div>
            </div>
          ))}
          {departments.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No departments found</div>}
        </div>
      </div>

      {/* Main — Detail / Create */}
      <div className={`flex-1 overflow-y-auto ${mobileView === 'list' ? 'hidden md:block' : 'block'}`}>
        {showCreate ? (
          <div className="max-w-2xl mx-auto p-4 sm:p-8">
            <button onClick={() => { setShowCreate(false); setMobileView('list'); }} className="md:hidden flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
              ← Back to list
            </button>
            <h2 className="text-xl font-bold text-foreground mb-6">{editingId ? 'Edit Department' : 'Create Department'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.10] text-foreground text-sm focus:outline-none" placeholder="e.g. Product Engineering" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.10] text-foreground text-sm focus:outline-none resize-none" placeholder="Department responsibilities, roles, and brief explanation..." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Alias (optional)</label>
                  <input value={form.alias} onChange={e => setForm(f => ({ ...f, alias: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.10] text-foreground text-sm focus:outline-none" placeholder="e.g. Engineering" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Color</label>
                  <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="w-full h-10 rounded-xl cursor-pointer" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={editingId ? updateDepartment : createDepartment} disabled={saving || !form.name.trim()}
                  className="px-6 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: 'var(--theme-primary, #3b82f6)' }}>
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
                <button onClick={() => { setShowCreate(false); setEditingId(null); setMobileView('list'); }}
                  className="px-6 py-2.5 rounded-xl bg-muted dark:bg-white/[0.06] text-foreground text-sm">Cancel</button>
              </div>
            </div>
          </div>
        ) : selected && detail ? (
          <div className="p-4 sm:p-6">
            {/* Mobile back button */}
            <button onClick={() => { setSelected(null); setDetail(null); setMobileView('list'); }} className="md:hidden flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
              ← Back to list
            </button>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold" style={{ background: detail.color || '#3b82f6' }}>
                {detail.name?.[0]}
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{detail.name}</h2>
                {detail.alias && <span className="text-xs text-muted-foreground">{detail.alias}</span>}
              </div>
            </div>

            {/* Tabs — scrollable on mobile */}
            <div className="flex gap-1 mb-6 border-b border-border dark:border-white/[0.08] overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-[var(--theme-primary,#3b82f6)] text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                  <tab.icon size={12} /> <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="rounded-xl bg-muted/30 dark:bg-white/[0.02] border border-border dark:border-white/[0.08] p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detail.description || 'No description yet.'}</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Staff', value: detail.staff?.length || 0, color: '#3b82f6' },
                    { label: 'Roles', value: detail.roles?.length || 0, color: '#8b5cf6' },
                    { label: 'Policies', value: detail.policies?.length || 0, color: '#10b981' },
                    { label: 'KPIs', value: detail.kpis?.length || 0, color: '#f59e0b' },
                    { label: 'Processes', value: detail.processes?.length || 0, color: '#ef4444' },
                    { label: 'Documents', value: detail.documents?.length || 0, color: '#06b6d4' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl bg-muted/30 dark:bg-white/[0.02] border border-border dark:border-white/[0.08] p-3 text-center">
                      <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-[10px] text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>
                {detail.head_name && (
                  <div className="text-xs text-muted-foreground">Department Head: <span className="text-foreground font-medium">{detail.head_name}</span></div>
                )}
              </div>
            )}

            {activeTab === 'roles' && (
              <div className="space-y-2">
                {detail.roles?.length ? detail.roles.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/30 dark:bg-white/[0.02] border border-border dark:border-white/[0.08]">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{r.name} {r.alias && <span className="text-muted-foreground">({r.alias})</span>}</div>
                      <div className="text-xs text-muted-foreground">{r.description}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted dark:bg-white/[0.06] text-muted-foreground">Level {r.hierarchy_level}</span>
                    {r.is_lead && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Lead</span>}
                  </div>
                )) : <div className="text-sm text-muted-foreground text-center py-8">No roles assigned to this department yet</div>}
              </div>
            )}

            {activeTab === 'policies' && (
              <div className="space-y-2">
                {detail.policies?.length ? detail.policies.map(p => (
                  <div key={p.id} className="px-4 py-3 rounded-xl bg-muted/30 dark:bg-white/[0.02] border border-border dark:border-white/[0.08]">
                    <div className="text-sm font-medium text-foreground">{p.title}</div>
                    {p.content && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.content}</div>}
                  </div>
                )) : <div className="text-sm text-muted-foreground text-center py-8">No policies defined</div>}
              </div>
            )}

            {activeTab === 'kpis' && (
              <div className="space-y-2">
                {detail.kpis?.length ? detail.kpis.map(k => (
                  <div key={k.id} className="px-4 py-3 rounded-xl bg-muted/30 dark:bg-white/[0.02] border border-border dark:border-white/[0.08]">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-foreground">{k.name}</div>
                      <div className="text-xs text-muted-foreground">{k.period}</div>
                    </div>
                    {k.description && <div className="text-xs text-muted-foreground mt-1">{k.description}</div>}
                    {k.target_value && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-muted dark:bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (k.current_value / k.target_value) * 100)}%`, background: 'var(--theme-primary, #3b82f6)' }} />
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">{k.current_value || 0} / {k.target_value} {k.unit || ''}</div>
                      </div>
                    )}
                  </div>
                )) : <div className="text-sm text-muted-foreground text-center py-8">No KPIs defined</div>}
              </div>
            )}

            {activeTab === 'processes' && (
              <div className="space-y-2">
                {detail.processes?.length ? detail.processes.map(p => (
                  <div key={p.id} className="px-4 py-3 rounded-xl bg-muted/30 dark:bg-white/[0.02] border border-border dark:border-white/[0.08]">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-foreground">{p.name}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{p.status}</span>
                    </div>
                    {p.description && <div className="text-xs text-muted-foreground mt-1">{p.description}</div>}
                  </div>
                )) : <div className="text-sm text-muted-foreground text-center py-8">No processes defined</div>}
              </div>
            )}

            {activeTab === 'staff' && (
              <div className="space-y-2">
                {detail.staff?.length ? detail.staff.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/30 dark:bg-white/[0.02] border border-border dark:border-white/[0.08]">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--theme-primary, #3b82f6)' }}>
                      {s.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.position || s.role}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{s.status}</span>
                  </div>
                )) : <div className="text-sm text-muted-foreground text-center py-8">No staff in this department</div>}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a department to view details, or create a new one
          </div>
        )}
      </div>
    </div>
  );
}
