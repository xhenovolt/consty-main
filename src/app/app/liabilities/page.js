'use client';

import { useEffect, useState } from 'react';
import { Plus, AlertCircle, Trash2, TrendingDown } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';

function formatCurr(amount, currency) {
  return `${currency || 'UGX'} ${Math.round(parseFloat(amount || 0)).toLocaleString()}`;
}

export default function LiabilitiesPage() {
  const [liabilities, setLiabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', currency: 'UGX', description: '' });
  const toast = useToast();

  useEffect(() => { fetchLiabilities(); }, []);

  const fetchLiabilities = async () => {
    try {
      const res = await fetchWithAuth('/api/liabilities');
      const json = await res.json();
      if (json.success) setLiabilities(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, amount: form.amount ? parseFloat(form.amount) : null };
      const res = await fetchWithAuth('/api/liabilities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) {
        setLiabilities(prev => [json.data, ...prev]);
        setForm({ name: '', amount: '', currency: 'UGX', description: '' });
        setShowForm(false);
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!await confirmDelete('liability')) return;
    try {
      await fetchWithAuth(`/api/liabilities?id=${id}`, { method: 'DELETE' });
      toast.success('Liability deleted');
      setLiabilities(prev => prev.filter(l => l.id !== id));
    } catch (err) { console.error(err); toast.error('Failed to delete'); }
  };

  const total = liabilities.reduce((s, l) => s + parseFloat(l.amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Liabilities</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {liabilities.length} liabilities · Total: UGX {Math.round(total).toLocaleString()}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition">
          <Plus className="w-4 h-4" /> Add Liability
        </button>
      </div>

      {/* Total Card */}
      <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
          <TrendingDown className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Liabilities</p>
          <p className="text-2xl font-bold text-red-600">UGX {Math.round(total).toLocaleString()}</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Add Liability</h2>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Liability name *" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
          <div className="flex gap-3">
            <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="w-20 px-2 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
              <option value="UGX">UGX</option>
              <option value="USD">USD</option>
            </select>
            <input type="number" step="1" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="Amount (optional)" className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
          </div>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Description" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition">{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : liabilities.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No liabilities recorded</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {liabilities.map(l => (
            <div key={l.id} className="p-4 flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-foreground">{l.name}</p>
                {l.description && <p className="text-sm text-muted-foreground">{l.description}</p>}
                {l.amount && <p className="text-sm font-semibold text-red-600 mt-1">{formatCurr(l.amount, l.currency)}</p>}
              </div>
              <button onClick={() => remove(l.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition ml-4 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/20">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
