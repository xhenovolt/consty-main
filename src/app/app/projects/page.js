'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Briefcase, Users, ListTree, AlertTriangle, ChevronRight } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import { PageTransition } from '@/components/ui/PageTransition';

const STATUS_STYLES = {
  draft: 'bg-muted text-muted-foreground', planning: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  approved: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  on_hold: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  frozen: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  closing: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  closed: 'bg-muted text-muted-foreground', cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
const HEALTH_DOT = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' };

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/projects${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      const json = await res.json();
      if (json.success) setProjects(json.data); else toast.error?.(json.error || 'Failed to load');
    } catch { toast.error?.('Failed to load projects'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1') {
      setShowNew(true);
    }
  }, []);

  return (
    <PageTransition>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-primary" /> Projects
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Plan, govern and execute real project work.</p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition">
            <Plus size={16} /> New Project
          </button>
        </div>

        <div className="relative mb-5 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Search by name or code…"
            className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground py-16 text-center">Loading projects…</div>
        ) : projects.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl py-16 text-center">
            <Briefcase className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-foreground font-medium">No projects yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first project to start planning work.</p>
            <button onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              <Plus size={16} /> New Project
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/app/projects/${p.id}`}
                className="group bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-primary/40 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${HEALTH_DOT[p.health] || 'bg-muted'}`} title={`Health: ${p.health}`} />
                      <span className="text-xs font-mono text-muted-foreground">{p.code}</span>
                    </div>
                    <h3 className="font-semibold text-foreground truncate mt-1 group-hover:text-primary">{p.name}</h3>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[p.status] || 'bg-muted'}`}>
                    {p.status?.replace('_', ' ')}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Progress</span><span>{Math.round(Number(p.progress_pct) || 0)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, Number(p.progress_pct) || 0)}%` }} />
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Users size={13} /> {p.member_count}</span>
                  <span className="inline-flex items-center gap-1"><ListTree size={13} /> {p.work_item_count}</span>
                  {Number(p.open_blockers) > 0 && (
                    <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle size={13} /> {p.open_blockers}</span>
                  )}
                  <ChevronRight size={14} className="ml-auto text-muted-foreground/50 group-hover:text-primary" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <NewProjectModal open={showNew} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />
    </PageTransition>
  );
}

function NewProjectModal({ open, onClose, onCreated }) {
  const empty = { name: '', code: '', type: 'construction', priority: 'medium', planned_start: '', planned_end: '', description: '' };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name.trim()) { toast.error?.('Project name is required'); return; }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, code: form.code || undefined, planned_start: form.planned_start || undefined, planned_end: form.planned_end || undefined }),
      });
      const json = await res.json();
      if (json.success) { toast.success?.('Project created'); setForm(empty); onCreated(json.data); }
      else toast.error?.(json.error || 'Failed to create project');
    } catch { toast.error?.('Failed to create project'); }
    finally { setSaving(false); }
  };

  const field = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';
  return (
    <Modal isOpen={open} onClose={onClose} title="New Project" subtitle="Create a real project record"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted/50">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-60">
            {saving ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      }>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input className={field} value={form.name} onChange={set('name')} placeholder="e.g. Riverside Apartments — Phase 1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Code</label>
            <input className={field} value={form.code} onChange={set('code')} placeholder="auto if blank" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select className={field} value={form.type} onChange={set('type')}>
              {['construction','infrastructure','field_ops','fitout','maintenance','consultancy','other'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select className={field} value={form.priority} onChange={set('priority')}>
              {['low','medium','high','critical'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Planned start</label>
            <input type="date" className={field} value={form.planned_start} onChange={set('planned_start')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Planned end</label>
            <input type="date" className={field} value={form.planned_end} onChange={set('planned_end')} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea className={`${field} resize-none`} rows={3} value={form.description} onChange={set('description')} />
        </div>
      </div>
    </Modal>
  );
}
