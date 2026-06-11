'use client';

import { useEffect, useState } from 'react';
import { Plus, PieChart, Wallet, AlertTriangle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const CATEGORIES = [
  { value: 'data', label: 'Data', color: 'bg-blue-100 text-blue-700' },
  { value: 'software_tools', label: 'Software Tools', color: 'bg-purple-100 text-purple-700' },
  { value: 'hosting', label: 'Hosting', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'food', label: 'Food', color: 'bg-orange-100 text-orange-700' },
  { value: 'transport', label: 'Transport', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'operations', label: 'Operations', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'savings', label: 'Savings', color: 'bg-green-100 text-green-700' },
  { value: 'rent', label: 'Rent', color: 'bg-red-100 text-red-700' },
  { value: 'hardware', label: 'Hardware', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'marketing', label: 'Marketing', color: 'bg-pink-100 text-pink-700' },
  { value: 'salaries', label: 'Salaries', color: 'bg-teal-100 text-teal-700' },
  { value: 'taxes', label: 'Taxes', color: 'bg-rose-100 text-rose-700' },
  { value: 'other', label: 'Other', color: 'bg-muted text-muted-foreground' },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));

function formatUGX(n) {
  return 'UGX ' + Math.round(parseFloat(n || 0)).toLocaleString();
}

export default function AllocationsPage() {
  const [allocations, setAllocations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    payment_id: '', category: 'operations', amount: '', currency: 'UGX', notes: '',
  });
  const toast = useToast();

  useEffect(() => {
    fetchAllocations();
    fetchWithAuth('/api/payments?status=completed&limit=50')
      .then(r => r.json())
      .then(j => { if (j.success) setPayments(j.data); });
  }, []);

  const fetchAllocations = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/allocations');
      const json = await res.json();
      if (json.success) setAllocations(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount), payment_id: form.payment_id || null }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Allocation recorded');
        setAllocations(prev => [json.data, ...prev]);
        setForm({ payment_id: '', category: 'operations', amount: '', currency: 'UGX', notes: '' });
        setShowForm(false);
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  // Group by category for summary
  const byCategory = CATEGORIES.map(cat => ({
    ...cat,
    total: allocations
      .filter(a => a.category === cat.value)
      .reduce((s, a) => s + parseFloat(a.amount || 0), 0),
  })).filter(c => c.total > 0);

  const grandTotal = allocations.reduce((s, a) => s + parseFloat(a.amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Money Allocations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {allocations.length} allocations · {formatUGX(grandTotal)} total allocated
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> Allocate Money
        </button>
      </div>

      {/* Category Breakdown */}
      {byCategory.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Allocation Breakdown</h2>
          <div className="space-y-2">
            {byCategory.map(cat => {
              const pct = grandTotal > 0 ? (cat.total / grandTotal) * 100 : 0;
              return (
                <div key={cat.value}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.color}`}>{cat.label}</span>
                    <span className="text-foreground font-medium">{formatUGX(cat.total)} <span className="text-muted-foreground">({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Allocate Form */}
      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Record Allocation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Category *</label>
              <select
                required
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Link to Payment</label>
              <select
                value={form.payment_id}
                onChange={e => setForm(f => ({ ...f, payment_id: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background"
              >
                <option value="">— Standalone allocation —</option>
                {payments.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.currency || 'UGX'} {Math.round(parseFloat(p.amount)).toLocaleString()} — {p.deal_title || 'payment'}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground shrink-0">Amount *</label>
            <div className="flex items-center gap-1 flex-1 border border-border rounded-lg overflow-hidden">
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="px-2 py-2 bg-muted text-foreground text-sm border-r border-border [&>option]:bg-background outline-none"
              >
                <option value="UGX">UGX</option>
                <option value="USD">USD</option>
              </select>
              <input
                required
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                className="flex-1 px-3 py-2 bg-background text-foreground text-sm outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes about this allocation…"
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition"
            >
              {saving ? 'Saving…' : 'Record Allocation'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Allocations List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : allocations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No allocations recorded</p>
          <p className="text-sm mt-1">Track every shilling — where it went and why</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {allocations.map(a => {
            const cat = CAT_MAP[a.category] || CAT_MAP.other;
            return (
              <div key={a.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition">
                <div className="flex items-start gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${cat.color} shrink-0`}>
                    {cat.label}
                  </span>
                  <div>
                    {a.deal_title && (
                      <p className="text-xs text-muted-foreground">From: {a.deal_title} · {a.client_label}</p>
                    )}
                    {a.notes && <p className="text-sm text-foreground">{a.notes}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">{a.currency} {Math.round(parseFloat(a.amount)).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
