'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'system_architecture', label: 'System Architecture' },
  { value: 'deployment_guide', label: 'Deployment Guide' },
  { value: 'sales_playbook', label: 'Sales Playbook' },
  { value: 'support_documentation', label: 'Support Docs' },
  { value: 'development_notes', label: 'Dev Notes' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'feature_documentation', label: 'Feature Docs' },
  { value: 'development_standards', label: 'Dev Standards' },
  { value: 'other', label: 'Other' },
];

const STATUS_COLORS = {
  draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  archived: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const VISIBILITY_ICONS = { private: '🔒', internal: '🏢', public: '🌐' };

export default function KnowledgePage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const [filterSystem, setFilterSystem] = useState('');
  const [search, setSearch] = useState('');
  const [systems, setSystems] = useState([]);

  const emptyForm = {
    title: '', category: 'system_architecture', system_id: '',
    visibility: 'internal', content: '', status: 'draft', tags: '',
  };
  const [form, setForm] = useState(emptyForm);
  const toast = useToast();

  const fetchAssets = useCallback(async () => {
    try {
      let url = '/api/knowledge?';
      if (filterCat) url += `category=${filterCat}&`;
      if (filterSystem) url += `system_id=${filterSystem}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;
      const res = await fetchWithAuth(url);
      if (res.success) setAssets(res.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterCat, filterSystem, search]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);
  useEffect(() => {
    fetchWithAuth('/api/systems').then(r => { if (r.success) setSystems(r.data || r.systems || []); }).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, system_id: form.system_id || null };
      if (editId) {
        const res = await fetchWithAuth('/api/knowledge', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editId, ...body }),
        });
        if (res.success) { setShowForm(false); setEditId(null); setForm(emptyForm); toast.success('Knowledge asset updated'); fetchAssets(); }
      } else {
        const res = await fetchWithAuth('/api/knowledge', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.success) { setShowForm(false); setForm(emptyForm); toast.success('Knowledge asset created'); fetchAssets(); }
        else toast.error(res.error || 'Failed');
      }
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const startEdit = (a) => {
    setForm({
      title: a.title, category: a.category, system_id: a.system_id || '',
      visibility: a.visibility, content: a.content || '', status: a.status,
      tags: Array.isArray(a.tags) ? a.tags.join(', ') : (a.tags || ''),
    });
    setEditId(a.id);
    setViewId(null);
    setShowForm(true);
  };

  const deleteAsset = async (id) => {
    if (!await confirmDelete('knowledge asset')) return;
    await fetchWithAuth(`/api/knowledge?id=${id}`, { method: 'DELETE' });
    toast.success('Knowledge asset deleted');
    fetchAssets();
  };

  const viewDoc = assets.find(a => a.id === viewId);

  if (loading) return <div className="p-8 text-center opacity-60">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-sm opacity-60 mt-1">Company intellectual property, documentation, and procedures</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setViewId(null); setForm(emptyForm); }}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium">
          {showForm ? 'Cancel' : '+ New Document'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border p-4 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">Total Documents</div>
          <div className="text-2xl font-bold mt-1">{assets.length}</div>
        </div>
        <div className="rounded-xl border p-4 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">Active</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">{assets.filter(a => a.status === 'active').length}</div>
        </div>
        <div className="rounded-xl border p-4 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">Drafts</div>
          <div className="text-2xl font-bold mt-1 text-yellow-600">{assets.filter(a => a.status === 'draft').length}</div>
        </div>
        <div className="rounded-xl border p-4 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">Systems Documented</div>
          <div className="text-2xl font-bold mt-1">{new Set(assets.filter(a => a.system_id).map(a => a.system_id)).size}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm bg-background">
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filterSystem} onChange={e => setFilterSystem(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm bg-background">
          <option value="">All Systems</option>
          {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search documents..." className="rounded-lg border px-3 py-1.5 text-sm bg-background flex-1 min-w-[200px]" />
      </div>

      {/* Document Viewer */}
      {viewDoc && !showForm && (
        <div className="bg-card rounded-xl border p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[viewDoc.status]}`}>{viewDoc.status}</span>
                <span className="text-xs opacity-50">{VISIBILITY_ICONS[viewDoc.visibility]} {viewDoc.visibility}</span>
                <span className="text-xs opacity-50">v{viewDoc.version}</span>
              </div>
              <h2 className="text-xl font-bold">{viewDoc.title}</h2>
              <div className="text-xs opacity-50 mt-1">
                {viewDoc.system_name && <span>System: {viewDoc.system_name} · </span>}
                {viewDoc.author_name && <span>By: {viewDoc.author_name} · </span>}
                <span>Updated: {new Date(viewDoc.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(viewDoc)} className="text-blue-500 text-sm hover:underline">Edit</button>
              <button onClick={() => setViewId(null)} className="text-sm opacity-50 hover:opacity-100">Close</button>
            </div>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap border-t pt-4">
            {viewDoc.content || <span className="opacity-40 italic">No content yet</span>}
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">{editId ? 'Edit Document' : 'Create New Document'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium mb-1 opacity-70">Title *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Drais Attendance Architecture" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Category *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                {CATEGORIES.filter(c => c.value).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">System</label>
              <select value={form.system_id} onChange={e => setForm(f => ({ ...f, system_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="">— General —</option>
                {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Visibility</label>
              <select value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="private">Private</option><option value="internal">Internal</option><option value="public">Public</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Tags (comma-separated)</label>
              <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="e.g. architecture, fingerprint" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium mb-1 opacity-70">Content (Markdown supported)</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={12}
                placeholder="Write documentation here... Markdown formatting is supported."
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-mono" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : editId ? 'Update' : 'Create Document'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}
              className="px-4 py-2 rounded-lg border text-sm hover:bg-muted">Cancel</button>
          </div>
        </form>
      )}

      {/* Document List */}
      {!viewDoc && !showForm && (
        assets.length === 0 ? (
          <div className="text-center py-16 opacity-50">
            <p className="text-lg font-medium">No documents yet</p>
            <p className="text-sm mt-1">Start building your company knowledge base</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border divide-y">
            {assets.map(a => (
              <div key={a.id} className="p-4 flex items-start justify-between hover:bg-muted/30 transition cursor-pointer"
                onClick={() => setViewId(a.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium">{a.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.status]}`}>{a.status}</span>
                    <span className="text-xs opacity-40">{VISIBILITY_ICONS[a.visibility]}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                      {CATEGORIES.find(c => c.value === a.category)?.label || a.category}
                    </span>
                  </div>
                  <div className="text-xs opacity-50 mt-0.5">
                    {a.system_name && <span>{a.system_name} · </span>}
                    {a.author_name && <span>{a.author_name} · </span>}
                    <span>v{a.version} · {new Date(a.updated_at).toLocaleDateString()}</span>
                  </div>
                  {a.content && <p className="text-xs opacity-40 mt-1 line-clamp-2">{a.content.substring(0, 200)}</p>}
                </div>
                <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => startEdit(a)} className="text-blue-500 text-xs hover:underline">Edit</button>
                  <button onClick={() => deleteAsset(a.id)} className="text-red-500 text-xs hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
