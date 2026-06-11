'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layers, Plus, Search, X, Loader2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const CATEGORIES = ['logo', 'illustration', 'social', 'business_card', 'flyer', 'sticker', 'banner', 'mockup', 'document', 'misc'];

export default function DesignTemplatesPage() {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterPub, setFilterPub] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: 'misc', tags: '', is_published: false });
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetchWithAuth('/api/designs/templates').then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Failed to load');
      setItems(r.data || []);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setCreating(true);
    try {
      const r = await fetchWithAuth('/api/designs/templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, description: form.description, category: form.category,
          tags: form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
          is_published: form.is_published,
          canvas: { width: 1080, height: 1080 }, layers: [],
        }),
      }).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Failed');
      toast.success('Template created');
      setShowForm(false);
      setForm({ name: '', description: '', category: 'misc', tags: '', is_published: false });
      load();
    } catch (e) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  const filtered = items.filter(t => {
    if (filterCat !== 'all' && t.category !== filterCat) return false;
    if (filterPub === 'published' && !t.is_published) return false;
    if (filterPub === 'draft' && t.is_published) return false;
    if (search && !`${t.name} ${t.description || ''} ${(t.tags || []).join(' ')}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="p-6 text-muted-foreground">Loading templates…</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Design Templates</h1>
            <p className="text-sm text-muted-foreground">Reusable starting points for designs.</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-1.5 cursor-pointer">
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-700 dark:text-red-400 rounded-lg p-3 text-sm">{error}</div>}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…"
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="px-3 py-2 bg-background border border-border rounded-lg text-sm [&>option]:bg-background">
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterPub} onChange={e => setFilterPub(e.target.value)} className="px-3 py-2 bg-background border border-border rounded-lg text-sm [&>option]:bg-background">
          <option value="all">All</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
          {items.length === 0 ? 'No templates yet.' : 'No templates match these filters.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(t => (
            <div key={t.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition">
              <div className="aspect-square bg-muted/30 flex items-center justify-center">
                {t.thumbnail_url ? (
                  <img src={t.thumbnail_url} alt={t.name} className="w-full h-full object-cover" />
                ) : (
                  <Layers className="w-10 h-10 text-muted-foreground opacity-40" />
                )}
              </div>
              <div className="p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-foreground truncate">{t.name}</span>
                  {t.is_published ? (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">live</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">draft</span>
                  )}
                </div>
                {t.category && <div className="text-xs text-muted-foreground capitalize">{t.category}</div>}
                <div className="text-xs text-muted-foreground">used {t.use_count}× · v{t.current_version}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title="New Template" onClose={() => setShowForm(false)} onConfirm={create} confirmLabel="Create" busy={creating}>
          <Input label="Name *" value={form.name} onChange={v => setForm(s => ({ ...s, name: v }))} />
          <Input label="Description" value={form.description} onChange={v => setForm(s => ({ ...s, description: v }))} />
          <Select label="Category" value={form.category} onChange={v => setForm(s => ({ ...s, category: v }))}
            options={CATEGORIES.map(c => [c, c])} />
          <Input label="Tags (comma separated)" value={form.tags} onChange={v => setForm(s => ({ ...s, tags: v }))} />
          <Check label="Publish immediately" value={form.is_published} onChange={v => setForm(s => ({ ...s, is_published: v }))} />
        </Modal>
      )}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';
const Input = ({ label, value, onChange, type = 'text' }) => (
  <div><label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className={inputCls} /></div>
);
const Select = ({ label, value, onChange, options }) => (
  <div><label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} className={`${inputCls} [&>option]:bg-background`}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select></div>
);
const Check = ({ label, value, onChange }) => (
  <label className="flex items-center gap-2 text-sm cursor-pointer">
    <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />
    <span className="text-foreground">{label}</span></label>
);
function Modal({ title, children, onClose, onConfirm, confirmLabel, busy }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-lg">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">{children}</div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted cursor-pointer">Cancel</button>
          <button onClick={onConfirm} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 cursor-pointer">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
