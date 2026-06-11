'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Folder, FolderPlus, ChevronRight, X, Loader2, ArrowLeft } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

export default function DocumentFoldersPage() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', parent_id: '' });
  const [creating, setCreating] = useState(false);
  const [currentPath, setCurrentPath] = useState([]); // breadcrumb
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    const r = await fetchWithAuth('/api/documents/folders').then(x => x.json()).catch(() => ({}));
    if (r.success) setFolders(r.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setCreating(true);
    try {
      const r = await fetchWithAuth('/api/documents/folders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, description: form.description,
          parent_id: form.parent_id || null,
        }),
      }).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Failed');
      toast.success('Folder created');
      setShowForm(false);
      setForm({ name: '', description: '', parent_id: '' });
      load();
    } catch (e) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  // Build a tree
  const byParent = folders.reduce((m, f) => {
    const k = f.parent_id || 'root';
    (m[k] ||= []).push(f);
    return m;
  }, {});

  // Current view: children of currentPath[last] (or root)
  const currentParent = currentPath[currentPath.length - 1] || null;
  const visible = byParent[currentParent?.id || 'root'] || [];

  if (loading) return <div className="p-6 text-muted-foreground">Loading folders…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href="/app/documents" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Documents
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Folder className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Folders</h1>
            <p className="text-sm text-muted-foreground">Hierarchical document organisation.</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-1.5 cursor-pointer">
          <FolderPlus className="w-4 h-4" /> New Folder
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
        <button onClick={() => setCurrentPath([])} className="hover:text-foreground cursor-pointer">root</button>
        {currentPath.map((f, i) => (
          <span key={f.id} className="inline-flex items-center gap-1">
            <ChevronRight className="w-3.5 h-3.5" />
            <button onClick={() => setCurrentPath(currentPath.slice(0, i + 1))} className="hover:text-foreground cursor-pointer">{f.name}</button>
          </span>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          <Folder className="w-10 h-10 mx-auto mb-3 opacity-40" />
          {folders.length === 0 ? 'No folders yet.' : 'This folder is empty.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {visible.map(f => (
            <button key={f.id} onClick={() => setCurrentPath([...currentPath, f])}
              className="bg-card border border-border rounded-lg p-4 text-left hover:border-primary/50 transition cursor-pointer">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-amber-500" />
                <span className="font-medium text-foreground">{f.name}</span>
              </div>
              {f.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.description}</p>}
              <div className="text-xs text-muted-foreground mt-2">{f.doc_count || 0} document{f.doc_count !== 1 ? 's' : ''}</div>
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-lg">New Folder</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(s => ({ ...s, description: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Parent folder</label>
              <select value={form.parent_id} onChange={e => setForm(s => ({ ...s, parent_id: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm [&>option]:bg-background">
                <option value="">— root —</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.path || f.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted cursor-pointer">Cancel</button>
              <button onClick={create} disabled={creating}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 cursor-pointer">
                {creating ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
