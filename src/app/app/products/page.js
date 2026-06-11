'use client';

import { useEffect, useState } from 'react';
import { Plus, Package, Trash2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';

function formatCurr(amount, currency) {
  return `${currency || 'UGX'} ${Math.round(parseFloat(amount || 0)).toLocaleString()}`;
}

const CATEGORIES = ['template', 'report', 'consulting', 'data_service', 'other'];

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', currency: 'UGX', category: '', status: 'active' });
  const toast = useToast();

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetchWithAuth('/api/products');
      const json = await res.json();
      if (json.success) setProducts(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, price: form.price ? parseFloat(form.price) : null };
      if (!body.category) delete body.category;
      const res = await fetchWithAuth('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) {
        setProducts(prev => [json.data, ...prev]);
        setForm({ name: '', description: '', price: '', currency: 'UGX', category: '', status: 'active' });
        setShowForm(false);
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!await confirmDelete('product')) return;
    try {
      await fetchWithAuth(`/api/products?id=${id}`, { method: 'DELETE' });
      toast.success('Product deleted');
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err) { console.error(err); toast.error('Failed to delete'); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground mt-1">Templates, reports, consulting packages, data services</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition">
          <Plus className="w-4 h-4" /> New Product
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Add Product</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Product name *" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
              <option value="">Category...</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Description" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
          <div className="flex gap-3">
            <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="w-20 px-2 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
              <option value="UGX">UGX</option>
              <option value="USD">USD</option>
              <option value="KES">KES</option>
            </select>
            <input type="number" step="1" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="Price (optional)" className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition">{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No products yet</p>
          <p className="text-sm mt-1">Add templates, reports, or consulting packages</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {products.map(p => (
            <div key={p.id} className="p-4 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-medium text-foreground">{p.name}</p>
                  {p.category && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize">{p.category.replace(/_/g, ' ')}</span>}
                </div>
                {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                {p.price && <p className="text-sm font-medium text-foreground mt-1">{formatCurr(p.price, p.currency)}</p>}
              </div>
              <button onClick={() => remove(p.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition ml-4 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/20">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
