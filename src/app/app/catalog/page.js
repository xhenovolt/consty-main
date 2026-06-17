'use client';

/**
 * Resource Catalog — reusable, company-wide material/resource definitions.
 * Project resources reference these so materials are defined once and reused
 * (and procurement/typeahead can suggest them) instead of being re-created.
 */
import { useEffect, useState, useCallback } from 'react';
import { Package, Plus, Search } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import { PageTransition } from '@/components/ui/PageTransition';

const CATEGORIES = ['material', 'equipment', 'vehicle', 'tool', 'fuel', 'consumable', 'reusable_asset',
  'labour', 'subcontractor', 'staff', 'water', 'power', 'permit', 'document', 'money'];
const field = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

export default function CatalogPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (cat) qs.set('category', cat);
      const res = await fetchWithAuth(`/api/catalog?${qs.toString()}`);
      const json = await res.json();
      if (json.success) setItems(json.catalog || []);
    } finally { setLoading(false); }
  }, [search, cat]);
  useEffect(() => { load(); }, [load]);

  const money = (v) => Number(v || 0).toLocaleString();

  return (
    <PageTransition>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Package className="w-6 h-6 text-primary" /> Resource Catalog</h1>
            <p className="text-sm text-muted-foreground mt-1">Define materials, equipment and labour once; reuse across every project.</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90">
            <Plus size={16} /> New Catalog Item
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…"
              className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${field} w-44`}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
        ) : items.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl py-16 text-center">
            <Package className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-foreground font-medium">No catalog items</p>
            <p className="text-sm text-muted-foreground mt-1">Add reusable materials so projects can pick instead of re-creating them.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 px-3 font-medium">Item</th>
                  <th className="py-2 px-3 font-medium">Category</th>
                  <th className="py-2 px-3 font-medium">Unit</th>
                  <th className="py-2 px-3 font-medium text-right">Default cost</th>
                  <th className="py-2 px-3 font-medium">Manufacturer</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 px-3">
                      <div className="font-medium text-foreground">{it.name}</div>
                      {it.specification && <div className="text-xs text-muted-foreground">{it.specification}</div>}
                    </td>
                    <td className="py-2 px-3"><span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">{it.category?.replace(/_/g, ' ')}</span></td>
                    <td className="py-2 px-3 text-muted-foreground">{it.unit_of_measure || '—'}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-foreground">{it.currency || ''} {money(it.unit_cost)}</td>
                    <td className="py-2 px-3 text-muted-foreground">{it.manufacturer || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && <NewCatalogItemModal onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load(); }} toast={toast} />}
    </PageTransition>
  );
}

function NewCatalogItemModal({ onClose, onDone, toast }) {
  const [f, setF] = useState({ name: '', category: 'material', unit_of_measure: '', specification: '', manufacturer: '', default_unit_cost: '' });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const submit = async () => {
    if (!f.name.trim()) { toast.error?.('Name is required'); return; }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/catalog', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, default_unit_cost: Number(f.default_unit_cost) || 0 }),
      });
      const j = await res.json();
      if (j.success) { toast.success?.('Catalog item added'); onDone(); } else toast.error?.(j.error || 'Failed');
    } finally { setSaving(false); }
  };
  return (
    <Modal isOpen onClose={onClose} title="New Catalog Item"
      footer={<div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border">Cancel</button>
        <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-60">{saving ? 'Adding…' : 'Add'}</button>
      </div>}>
      <div className="space-y-4">
        <div><label className="block text-sm font-medium mb-1">Name *</label><input className={field} value={f.name} onChange={set('name')} autoFocus placeholder="e.g. Cement" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium mb-1">Category</label>
            <select className={field} value={f.category} onChange={set('category')}>{CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}</select></div>
          <div><label className="block text-sm font-medium mb-1">Unit of measure</label><input className={field} value={f.unit_of_measure} onChange={set('unit_of_measure')} placeholder="bags, kg, hrs" /></div>
        </div>
        <div><label className="block text-sm font-medium mb-1">Specification</label><input className={field} value={f.specification} onChange={set('specification')} placeholder="e.g. Tororo PPC 32.5R" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium mb-1">Manufacturer</label><input className={field} value={f.manufacturer} onChange={set('manufacturer')} /></div>
          <div><label className="block text-sm font-medium mb-1">Default unit cost</label><input type="number" className={field} value={f.default_unit_cost} onChange={set('default_unit_cost')} /></div>
        </div>
      </div>
    </Modal>
  );
}
