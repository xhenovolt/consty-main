'use client';

import { useEffect, useState } from 'react';
import { ArrowRightLeft, Plus, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';
import { useToast } from '@/components/ui/Toast';

export default function TransfersPage() {
  const [transfers, setTransfers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ from_account_id: '', to_account_id: '', amount: '', description: '' });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchTransfers();
    fetchWithAuth('/api/accounts').then(r => r.json()).then(j => { if (j.success) setAccounts(j.data); }).catch(() => {});
  }, []);

  const fetchTransfers = async () => {
    try { const res = await fetchWithAuth('/api/transfers'); const j = await res.json(); if (j.success) setTransfers(j.data); } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.from_account_id === form.to_account_id) { toast.error('Source and destination must be different'); return; }
    setSaving(true);
    try {
      const body = { ...form, amount: parseFloat(form.amount) };
      if (!body.description) delete body.description;
      const res = await fetchWithAuth('/api/transfers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if ((await res.json()).success) { toast.success('Transfer completed'); setShowForm(false); setForm({ from_account_id: '', to_account_id: '', amount: '', description: '' }); fetchTransfers(); }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };


  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transfers</h1>
          <p className="text-sm text-muted-foreground mt-1">{transfers.length} transfers</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {showForm ? 'Cancel' : 'New Transfer'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">Transfer Funds</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">From Account *</label>
              <select value={form.from_account_id} onChange={e => setForm(f => ({ ...f, from_account_id: e.target.value }))} required className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                <option value="">Select source...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">To Account *</label>
              <select value={form.to_account_id} onChange={e => setForm(f => ({ ...f, to_account_id: e.target.value }))} required className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                <option value="">Select destination...</option>
                {accounts.filter(a => a.id !== form.from_account_id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Amount *</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" placeholder="Reason for transfer..." />
          </div>
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Transferring...' : 'Execute Transfer'}</button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : transfers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No transfers yet</div>
      ) : (
        <div className="bg-card rounded-xl border divide-y">
          {transfers.map(t => (
            <div key={t.id} className="flex items-center justify-between p-4 hover:bg-muted transition">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg"><ArrowRightLeft className="w-4 h-4 text-blue-600" /></div>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {t.from_account_name} <span className="text-muted-foreground mx-1">→</span> {t.to_account_name}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {t.description && <span>{t.description}</span>}
                    <span>{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <span className="text-sm font-bold text-blue-600">{formatCurrency(t.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
