'use client';

import { useEffect, useState, useCallback } from 'react';
import { BookMarked, Plus, X, Edit3, Trash2, Search, Filter, ChevronRight, Calendar, Tag, MessageSquare, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';
import RecordComments from '@/components/shared/RecordComments';

const CATEGORIES = ['general', 'technical', 'financial', 'operational', 'strategic', 'hiring', 'product', 'legal'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['proposed', 'under_review', 'decided', 'implemented', 'reversed', 'deferred'];

const PRIORITY_COLORS = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700',
};

const STATUS_COLORS = {
  proposed: 'bg-muted text-muted-foreground',
  under_review: 'bg-yellow-100 text-yellow-700',
  decided: 'bg-blue-100 text-blue-700',
  implemented: 'bg-emerald-100 text-emerald-700',
  reversed: 'bg-red-100 text-red-700',
  deferred: 'bg-orange-100 text-orange-700',
};

export default function DecisionLogPage() {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [departments, setDepartments] = useState([]);
  const toast = useToast();

  const [form, setForm] = useState({
    title: '', description: '', category: 'general', priority: 'medium', status: 'decided',
    decision_date: new Date().toISOString().slice(0, 10), context: '', alternatives: '',
    consequences: '', tags: '', department_id: '',
  });

  const fetchDecisions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterCategory) params.set('category', filterCategory);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/decision-logs?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setDecisions(data.data || []);
    } catch {} finally { setLoading(false); }
  }, [search, filterCategory, filterStatus]);

  useEffect(() => { fetchDecisions(); }, [fetchDecisions]);

  useEffect(() => {
    fetch('/api/departments', { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.success) setDepartments(d.data || []); }).catch(() => {});
  }, []);

  const selectDecision = async (d) => {
    setSelected(d);
    setShowCreate(false);
    setEditing(false);
    try {
      const res = await fetch(`/api/decision-logs/${d.id}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setDetail(data.data);
    } catch {}
  };

  const resetForm = () => setForm({
    title: '', description: '', category: 'general', priority: 'medium', status: 'decided',
    decision_date: new Date().toISOString().slice(0, 10), context: '', alternatives: '',
    consequences: '', tags: '', department_id: '',
  });

  const createDecision = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body = { ...form, tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [] };
      if (!body.department_id) delete body.department_id;
      const res = await fetch('/api/decision-logs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Decision logged');
        setShowCreate(false);
        resetForm();
        fetchDecisions();
      } else toast.error(data.error);
    } catch { toast.error('Failed to create'); } finally { setSaving(false); }
  };

  const updateDecision = async () => {
    if (!detail?.id) return;
    setSaving(true);
    try {
      const body = { ...form, tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [] };
      if (!body.department_id) delete body.department_id;
      const res = await fetch(`/api/decision-logs/${detail.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Decision updated');
        setEditing(false);
        selectDecision({ id: detail.id });
        fetchDecisions();
      } else toast.error(data.error);
    } catch { toast.error('Failed to update'); } finally { setSaving(false); }
  };

  const deleteDecision = async (id) => {
    if (!await confirmDelete('decision log entry')) return;
    try {
      const res = await fetch(`/api/decision-logs/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        toast.success('Deleted');
        if (selected?.id === id) { setSelected(null); setDetail(null); }
        fetchDecisions();
      } else toast.error(data.error);
    } catch { toast.error('Failed to delete'); }
  };

  const startEditing = () => {
    if (!detail) return;
    setForm({
      title: detail.title || '', description: detail.description || '', category: detail.category || 'general',
      priority: detail.priority || 'medium', status: detail.status || 'decided',
      decision_date: detail.decision_date?.split('T')[0] || '', context: detail.context || '',
      alternatives: detail.alternatives || '', consequences: detail.consequences || '',
      tags: (detail.tags || []).join(', '), department_id: detail.department_id || '',
    });
    setEditing(true);
  };

  const DecisionForm = ({ onSubmit, submitLabel }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm text-muted-foreground mb-1">Title *</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" placeholder="What was decided?" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-muted-foreground mb-1">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none" />
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Category</label>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Priority</label>
          <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm">
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Status</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm">
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Decision Date</label>
          <input type="date" value={form.decision_date} onChange={e => setForm(f => ({ ...f, decision_date: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Department</label>
          <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm">
            <option value="">None</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Tags (comma-separated)</label>
          <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="architecture, budget, hiring" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-muted-foreground mb-1">Context / Reasoning</label>
          <textarea value={form.context} onChange={e => setForm(f => ({ ...f, context: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none" placeholder="Why was this decision made?" />
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Alternatives Considered</label>
          <textarea value={form.alternatives} onChange={e => setForm(f => ({ ...f, alternatives: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none" />
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Expected Consequences</label>
          <textarea value={form.consequences} onChange={e => setForm(f => ({ ...f, consequences: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none" />
        </div>
      </div>
      <button onClick={onSubmit} disabled={saving || !form.title.trim()} className="px-6 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--theme-primary, #3b82f6)' }}>{saving ? 'Saving...' : submitLabel}</button>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar List */}
      <div className="w-80 border-r border-border flex flex-col bg-background">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <BookMarked className="w-5 h-5" style={{ color: 'var(--theme-primary, #3b82f6)' }} />
              Decision Log
            </h1>
            <button onClick={() => { setShowCreate(!showCreate); setSelected(null); setDetail(null); resetForm(); }} className="p-1.5 rounded-lg hover:bg-muted">
              {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search decisions..." className="w-full pl-8 pr-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
          </div>
          <div className="flex gap-1">
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="flex-1 px-2 py-1 border border-border rounded text-xs bg-background text-foreground">
              <option value="">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="flex-1 px-2 py-1 border border-border rounded text-xs bg-background text-foreground">
              <option value="">All statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: 'var(--theme-primary, #3b82f6)' }} /></div>
          ) : decisions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No decisions found</div>
          ) : (
            decisions.map(d => (
              <button
                key={d.id}
                onClick={() => selectDecision(d)}
                className={`w-full text-left p-3 border-b border-border hover:bg-muted/50 transition ${selected?.id === d.id ? 'bg-muted/50' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[d.priority]}`}>{d.priority}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[d.status]}`}>{d.status?.replace('_', ' ')}</span>
                </div>
                <div className="text-sm font-medium text-foreground line-clamp-2">{d.title}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                  <span>{d.category}</span>
                  {d.department_name && <span>· {d.department_name}</span>}
                  <span>· {new Date(d.decision_date).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })}</span>
                  {d.comment_count > 0 && <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3" />{d.comment_count}</span>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {showCreate ? (
          <div className="max-w-3xl">
            <h2 className="text-xl font-bold text-foreground mb-4">Log New Decision</h2>
            <DecisionForm onSubmit={createDecision} submitLabel="Log Decision" />
          </div>
        ) : detail ? (
          <div className="max-w-3xl space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[detail.priority]}`}>{detail.priority}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[detail.status]}`}>{detail.status?.replace('_', ' ')}</span>
                <span className="text-xs text-muted-foreground">{detail.category}</span>
                {detail.department_name && <span className="text-xs text-muted-foreground">· {detail.department_name}</span>}
              </div>
              <h2 className="text-xl font-bold text-foreground">{detail.title}</h2>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(detail.decision_date).toLocaleDateString('en-UG', { dateStyle: 'medium' })}</span>
                {detail.decided_by_name && <span>Decided by {detail.decided_by_name}</span>}
                {detail.tags?.length > 0 && detail.tags.map(t => <span key={t} className="px-1.5 py-0.5 bg-muted rounded text-xs">{t}</span>)}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={startEditing} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted"><Edit3 className="w-3 h-3" /> Edit</button>
                <button onClick={() => deleteDecision(detail.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-border hover:bg-red-50 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/20"><Trash2 className="w-3 h-3" /> Delete</button>
              </div>
            </div>

            {editing ? (
              <div className="bg-card rounded-xl border p-5">
                <h3 className="font-semibold mb-3">Edit Decision</h3>
                <DecisionForm onSubmit={updateDecision} submitLabel="Update" />
              </div>
            ) : (
              <>
                {/* Detail sections */}
                {detail.description && (
                  <div className="bg-card rounded-xl border p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">{detail.description}</p>
                  </div>
                )}
                {detail.context && (
                  <div className="bg-card rounded-xl border p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-2">Context & Reasoning</h3>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">{detail.context}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {detail.alternatives && (
                    <div className="bg-card rounded-xl border p-4">
                      <h3 className="text-sm font-semibold text-foreground mb-2">Alternatives Considered</h3>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap">{detail.alternatives}</p>
                    </div>
                  )}
                  {detail.consequences && (
                    <div className="bg-card rounded-xl border p-4">
                      <h3 className="text-sm font-semibold text-foreground mb-2">Expected Consequences</h3>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap">{detail.consequences}</p>
                    </div>
                  )}
                </div>

                {detail.reviewed_by_name && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-4">
                    <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-1 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Reviewed</h3>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">
                      Reviewed by {detail.reviewed_by_name} on {detail.review_date ? new Date(detail.review_date).toLocaleDateString('en-UG') : 'N/A'}
                    </p>
                    {detail.review_notes && <p className="text-sm text-foreground/70 mt-1">{detail.review_notes}</p>}
                  </div>
                )}

                {/* Comments */}
                <div className="bg-card rounded-xl border p-5">
                  <RecordComments entityType="decision_log" entityId={detail.id} />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <BookMarked className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">Decision Log</p>
              <p className="text-sm mt-1">Select a decision or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
