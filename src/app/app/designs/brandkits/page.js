'use client';

import { useEffect, useState } from 'react';
import { Palette, Plus, X, Loader2, Trash2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

export default function BrandKitsPage() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', is_default: false, palette: [], typography: [], logos: [] });
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    const r = await fetchWithAuth('/api/designs/brandkits').then(x => x.json()).catch(() => ({}));
    if (r.success) setItems(r.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setCreating(true);
    try {
      const r = await fetchWithAuth('/api/designs/brandkits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Failed');
      toast.success('Brand kit created');
      setShowForm(false);
      setForm({ name: '', description: '', is_default: false, palette: [], typography: [], logos: [] });
      load();
    } catch (e) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading brand kits…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Palette className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Brand Kits</h1>
            <p className="text-sm text-muted-foreground">Logos, palette, and typography for brand consistency.</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-1.5 cursor-pointer">
          <Plus className="w-4 h-4" /> New Kit
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          <Palette className="w-10 h-10 mx-auto mb-3 opacity-40" />
          No brand kits yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(k => (
            <div key={k.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{k.name}</h3>
                {k.is_default && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">default</span>}
              </div>
              {k.description && <p className="text-sm text-muted-foreground">{k.description}</p>}
              {Array.isArray(k.palette) && k.palette.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Palette</div>
                  <div className="flex flex-wrap gap-1">
                    {k.palette.map((c, i) => (
                      <div key={i} className="w-8 h-8 rounded border border-border" style={{ background: c.hex }} title={`${c.name || ''} ${c.hex}`} />
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(k.typography) && k.typography.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Typography</div>
                  <ul className="text-sm text-foreground space-y-0.5">
                    {k.typography.map((t, i) => (
                      <li key={i}>{t.role}: <span className="font-medium">{t.family}</span> {t.weight} {t.size && `· ${t.size}`}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && <BrandkitForm form={form} setForm={setForm} onClose={() => setShowForm(false)} onSubmit={create} busy={creating} />}
    </div>
  );
}

function BrandkitForm({ form, setForm, onClose, onSubmit, busy }) {
  const addColor = () => setForm(s => ({ ...s, palette: [...(s.palette || []), { name: '', hex: '#000000' }] }));
  const setColor = (i, k, v) => setForm(s => {
    const next = [...s.palette]; next[i] = { ...next[i], [k]: v }; return { ...s, palette: next };
  });
  const rmColor = (i) => setForm(s => ({ ...s, palette: s.palette.filter((_, j) => j !== i) }));

  const addType = () => setForm(s => ({ ...s, typography: [...(s.typography || []), { role: 'heading', family: 'Inter', weight: '600', size: '24px' }] }));
  const setType = (i, k, v) => setForm(s => {
    const next = [...s.typography]; next[i] = { ...next[i], [k]: v }; return { ...s, typography: next };
  });
  const rmType = (i) => setForm(s => ({ ...s, typography: s.typography.filter((_, j) => j !== i) }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-lg">New Brand Kit</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <Input label="Name *" value={form.name} onChange={v => setForm(s => ({ ...s, name: v }))} />
        <Input label="Description" value={form.description} onChange={v => setForm(s => ({ ...s, description: v }))} />

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-muted-foreground">Palette</label>
            <button onClick={addColor} className="text-xs text-primary hover:underline cursor-pointer">+ Add color</button>
          </div>
          {(form.palette || []).map((c, i) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              <input type="color" value={c.hex} onChange={e => setColor(i, 'hex', e.target.value)} className="w-10 h-9 rounded border border-border" />
              <input value={c.name} onChange={e => setColor(i, 'name', e.target.value)} placeholder="primary"
                className="flex-1 px-2 py-1 bg-background border border-border rounded text-sm" />
              <input value={c.hex} onChange={e => setColor(i, 'hex', e.target.value)}
                className="w-24 px-2 py-1 bg-background border border-border rounded text-xs font-mono" />
              <button onClick={() => rmColor(i)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded cursor-pointer"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-muted-foreground">Typography</label>
            <button onClick={addType} className="text-xs text-primary hover:underline cursor-pointer">+ Add</button>
          </div>
          {(form.typography || []).map((t, i) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              <input value={t.role} onChange={e => setType(i, 'role', e.target.value)} placeholder="heading"
                className="flex-1 px-2 py-1 bg-background border border-border rounded text-sm" />
              <input value={t.family} onChange={e => setType(i, 'family', e.target.value)} placeholder="Inter"
                className="flex-1 px-2 py-1 bg-background border border-border rounded text-sm" />
              <input value={t.weight} onChange={e => setType(i, 'weight', e.target.value)} placeholder="600"
                className="w-16 px-2 py-1 bg-background border border-border rounded text-sm" />
              <input value={t.size} onChange={e => setType(i, 'size', e.target.value)} placeholder="24px"
                className="w-20 px-2 py-1 bg-background border border-border rounded text-sm" />
              <button onClick={() => rmType(i)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded cursor-pointer"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.is_default} onChange={e => setForm(s => ({ ...s, is_default: e.target.checked }))} />
          <span className="text-foreground">Set as default</span>
        </label>

        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted cursor-pointer">Cancel</button>
          <button onClick={onSubmit} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 cursor-pointer">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';
const Input = ({ label, value, onChange }) => (
  <div><label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
    <input value={value} onChange={e => onChange(e.target.value)} className={inputCls} /></div>
);
