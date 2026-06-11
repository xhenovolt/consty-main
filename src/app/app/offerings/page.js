'use client';

import { useEffect, useState } from 'react';
import { Package, Plus, X, Edit, Trash2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';

const TYPES = ['product', 'service', 'subscription', 'package'];

export default function OfferingsPage() {
  const [offerings, setOfferings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'service', description: '', default_price: '', currency: 'UGX' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => { fetchOfferings(); }, []);

  const fetchOfferings = async () => {
    try { const res = await fetchWithAuth('/api/offerings'); const j = await res.json(); if (j.success) setOfferings(j.data); } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const body = { ...form };
      if (body.default_price) body.default_price = parseFloat(body.default_price);
      else delete body.default_price;
      if (!body.description) delete body.description;
      const url = editId ? `/api/offerings/${editId}` : '/api/offerings';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if ((await res.json()).success) { toast.success(editId ? 'Offering updated' : 'Offering created'); setShowForm(false); setEditId(null); setForm({ name: '', type: 'service', description: '', default_price: '', currency: 'UGX' }); fetchOfferings(); }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const startEdit = (o) => {
    setForm({ name: o.name, type: o.type || 'service', description: o.description || '', default_price: o.default_price?.toString() || '', currency: o.currency || 'UGX' });
    setEditId(o.id); setShowForm(true);
  };

  const deleteOffering = async (id) => {
    if (!await confirmDelete('offering')) return;
    try {
      const res = await fetchWithAuth(`/api/offerings/${id}`, { method: 'DELETE' });
      const j = await res.json();
      if (!j.success) toast.error(j.error || 'Cannot delete');
      else toast.success('Offering deleted');
      fetchOfferings();
    } catch { toast.error('Failed to delete'); }
  };


  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Offerings</h1>
          <p className="text-sm text-muted-foreground mt-1">{offerings.length} products & services</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', type: 'service', description: '', default_price: '', currency: 'UGX' }); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {showForm ? 'Cancel' : 'New Offering'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">{editId ? 'Edit' : 'Create'} Offering</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" placeholder="e.g. Website Design" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Default Price</label>
              <input type="number" step="0.01" value={form.default_price} onChange={e => setForm(f => ({ ...f, default_price: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Currency</label>
              <input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-muted-foreground mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" placeholder="What does this offering include?" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : editId ? 'Update Offering' : 'Create Offering'}</button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : offerings.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No offerings yet. Add your products and services.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offerings.map(o => (
            <div key={o.id} className="bg-card rounded-xl border p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-foreground">{o.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(o)} className="p-1 hover:bg-muted rounded"><Edit className="w-4 h-4 text-muted-foreground" /></button>
                  <button onClick={() => deleteOffering(o.id)} className="p-1 hover:bg-red-50 rounded dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-600" /></button>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 capitalize dark:bg-blue-900/30 dark:text-blue-300">{o.type}</span>
                {o.deal_count > 0 && <span className="text-xs text-muted-foreground">{o.deal_count} deals</span>}
              </div>
              {o.description && <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{o.description}</p>}
              {o.default_price && <div className="text-lg font-bold text-foreground">{formatCurrency(o.default_price)} <span className="text-xs font-normal text-muted-foreground">{o.currency}</span></div>}
              {!o.is_active && <span className="text-xs text-red-500 mt-1">Inactive</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
