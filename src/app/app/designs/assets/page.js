'use client';

import { useEffect, useState, useRef } from 'react';
import { Image as ImgIcon, Plus, Search, X, Loader2, Upload } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const ASSET_TYPES = ['logo', 'illustration', 'photo', 'icon', 'shape', 'svg', 'font', 'pattern', 'mockup', 'other'];

export default function DesignAssetsPage() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: '', asset_type: 'logo', category: '', file_url: '', tags: '' });
  const fileRef = useRef(null);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    const r = await fetchWithAuth('/api/designs/assets').then(x => x.json()).catch(() => ({}));
    if (r.success) setItems(r.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Upload via existing internal upload endpoint or Cloudinary helper.
      // Fall back to a generic /api/upload route if it exists.
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'consty/designs');
      const r = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' });
      const data = await r.json();
      if (!r.ok || !data.url) throw new Error(data.error || 'Upload failed');
      setForm(s => ({
        ...s,
        file_url: data.url,
        name: s.name || file.name.replace(/\.[^.]+$/, ''),
      }));
      toast.success('Uploaded');
    } catch (err) { toast.error(err.message + ' — paste a URL instead'); }
    finally { setUploading(false); }
  };

  const create = async () => {
    if (!form.name.trim() || !form.file_url) { toast.error('Name and file URL required'); return; }
    const r = await fetchWithAuth('/api/designs/assets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        category: form.category || null,
        tags: form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
      }),
    }).then(x => x.json());
    if (r.success) {
      toast.success('Asset added');
      setShowForm(false);
      setForm({ name: '', asset_type: 'logo', category: '', file_url: '', tags: '' });
      load();
    } else toast.error(r.error || 'Failed');
  };

  const filtered = items.filter(a => {
    if (filterType !== 'all' && a.asset_type !== filterType) return false;
    if (search && !`${a.name} ${a.category || ''} ${(a.tags || []).join(' ')}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="p-6 text-muted-foreground">Loading assets…</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/30">
            <ImgIcon className="w-5 h-5 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Asset Library</h1>
            <p className="text-sm text-muted-foreground">Logos, illustrations, photos, and more.</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-1.5 cursor-pointer">
          <Plus className="w-4 h-4" /> Add Asset
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…"
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 bg-background border border-border rounded-lg text-sm [&>option]:bg-background">
          <option value="all">All types</option>
          {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          <ImgIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
          {items.length === 0 ? 'No assets yet.' : 'No matches.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(a => (
            <div key={a.id} className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="aspect-square bg-muted/30 flex items-center justify-center">
                {a.thumbnail_url || a.file_url ? (
                  <img src={a.thumbnail_url || a.file_url} alt={a.name} className="w-full h-full object-contain" />
                ) : <ImgIcon className="w-8 h-8 text-muted-foreground opacity-40" />}
              </div>
              <div className="p-2">
                <div className="text-xs font-medium text-foreground truncate">{a.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{a.asset_type}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-lg">Add Asset</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <Input label="Name *" value={form.name} onChange={v => setForm(s => ({ ...s, name: v }))} />
            <Select label="Type" value={form.asset_type} onChange={v => setForm(s => ({ ...s, asset_type: v }))}
              options={ASSET_TYPES.map(t => [t, t])} />
            <Input label="Category" value={form.category} onChange={v => setForm(s => ({ ...s, category: v }))} />
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">File</label>
              <div className="flex gap-2">
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Uploading…' : 'Upload file'}
                </button>
                <input ref={fileRef} type="file" hidden onChange={onFile} accept="image/*,application/pdf,font/*" />
              </div>
              <input value={form.file_url} onChange={e => setForm(s => ({ ...s, file_url: e.target.value }))}
                placeholder="…or paste a URL"
                className="mt-2 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <Input label="Tags (comma separated)" value={form.tags} onChange={v => setForm(s => ({ ...s, tags: v }))} />
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted cursor-pointer">Cancel</button>
              <button onClick={create} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 cursor-pointer">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';
const Input = ({ label, value, onChange }) => (
  <div><label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
    <input value={value} onChange={e => onChange(e.target.value)} className={inputCls} /></div>
);
const Select = ({ label, value, onChange, options }) => (
  <div><label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} className={`${inputCls} [&>option]:bg-background`}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select></div>
);
