'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';

const COST_TYPES = [
  { value: 'developer_time', label: 'Developer Time' },
  { value: 'hosting', label: 'Hosting' },
  { value: 'domain', label: 'Domain' },
  { value: 'api_service', label: 'API / Service' },
  { value: 'internet', label: 'Internet' },
  { value: 'transport', label: 'Transport' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'software_license', label: 'Software License' },
  { value: 'other', label: 'Other' },
];

function formatMoney(amount, currency = 'UGX') {
  if (!amount) return `${currency} 0`;
  return `${currency} ${Number(amount).toLocaleString()}`;
}

export default function SystemCostsPage() {
  const [costs, setCosts] = useState([]);
  const [summary, setSummary] = useState([]);
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterSystem, setFilterSystem] = useState('');
  const [form, setForm] = useState({
    system_id: '', cost_type: 'developer_time', amount: '', currency: 'UGX',
    cost_date: new Date().toISOString().split('T')[0], description: '', notes: '',
  });
  const toast = useToast();

  const fetchCosts = useCallback(async () => {
    try {
      const url = filterSystem ? `/api/system-costs?system_id=${filterSystem}` : '/api/system-costs';
      const res = await fetchWithAuth(url);
      if (res.success) {
        setCosts(res.data || []);
        setSummary(res.summary || []);
      }
    } catch (e) { console.error('Failed to fetch costs:', e); }
  }, [filterSystem]);

  const fetchSystems = async () => {
    try {
      const res = await fetchWithAuth('/api/systems');
      if (res.success) setSystems(res.data || []);
      else if (Array.isArray(res)) setSystems(res);
    } catch (e) { console.error('Failed to fetch systems:', e); }
  };

  useEffect(() => { fetchSystems(); }, []);
  useEffect(() => { fetchCosts(); setLoading(false); }, [fetchCosts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.system_id || !form.amount) return;
    try {
      const res = await fetchWithAuth('/api/system-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      });
      if (res.success) {
        setShowForm(false);
        setForm({ system_id: '', cost_type: 'developer_time', amount: '', currency: 'UGX',
          cost_date: new Date().toISOString().split('T')[0], description: '', notes: '' });
        fetchCosts();
      }
    } catch (e) { console.error('Failed to create cost:', e); }
  };

  const handleDelete = async (id) => {
    if (!await confirmDelete('cost entry')) return;
    try {
      await fetchWithAuth(`/api/system-costs?id=${id}`, { method: 'DELETE' });
      toast.success('Cost entry deleted');
      fetchCosts();
    } catch (e) { console.error('Failed to delete:', e); toast.error('Failed to delete'); }
  };

  const totalCost = summary.reduce((acc, s) => acc + Number(s.total_cost || 0), 0);

  if (loading) return <div className="p-8 text-center opacity-60">Loading…</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Development Costs</h1>
          <p className="text-sm opacity-60 mt-1">
            Track every cost incurred while building and maintaining systems
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium">
          {showForm ? 'Cancel' : '+ Add Cost'}
        </button>
      </div>

      {/* Summary Cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border p-4" style={{ background: 'var(--card-bg, #fff)' }}>
            <div className="text-xs font-medium opacity-60 uppercase">Total Invested</div>
            <div className="text-2xl font-bold mt-1">{formatMoney(totalCost)}</div>
            <div className="text-xs opacity-50 mt-1">{costs.length} entries across {summary.length} systems</div>
          </div>
          {summary.slice(0, 3).map(s => (
            <div key={s.system_id} className="rounded-xl border p-4" style={{ background: 'var(--card-bg, #fff)' }}>
              <div className="text-xs font-medium opacity-60 uppercase truncate">{s.system_name || 'Unknown'}</div>
              <div className="text-xl font-bold mt-1">{formatMoney(s.total_cost)}</div>
              <div className="text-xs opacity-50 mt-1">{s.entry_count} entries</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Filter by system:</label>
        <select value={filterSystem} onChange={e => setFilterSystem(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm" style={{ background: 'var(--input-bg, #fff)' }}>
          <option value="">All Systems</option>
          {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--card-bg, #fff)' }}>
          <h3 className="font-semibold">New Cost Entry</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">System *</label>
              <select value={form.system_id} onChange={e => setForm({...form, system_id: e.target.value})} required
                className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--input-bg, #fff)' }}>
                <option value="">Select system…</option>
                {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Cost Type *</label>
              <select value={form.cost_type} onChange={e => setForm({...form, cost_type: e.target.value})} required
                className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--input-bg, #fff)' }}>
                {COST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Amount (UGX) *</label>
              <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
                required min="0" step="any" placeholder="50000"
                className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--input-bg, #fff)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Date</label>
              <input type="date" value={form.cost_date} onChange={e => setForm({...form, cost_date: e.target.value})}
                className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--input-bg, #fff)' }} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Description</label>
              <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                placeholder="e.g., 3 hours frontend work, Neon DB plan"
                className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--input-bg, #fff)' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              rows={2} placeholder="Additional context…"
              className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--input-bg, #fff)' }} />
          </div>
          <button type="submit" className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium">
            Save Cost Entry
          </button>
        </form>
      )}

      {/* Table */}
      {costs.length === 0 ? (
        <div className="text-center py-12 opacity-50">
          <p className="text-lg font-medium">No cost entries yet</p>
          <p className="text-sm mt-1">Start tracking development costs by adding your first entry</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ background: 'var(--card-bg, #fff)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">System</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {costs.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-black/5 dark:hover:bg-white/5">
                  <td className="px-4 py-3 whitespace-nowrap">{c.cost_date?.split('T')[0]}</td>
                  <td className="px-4 py-3 font-medium">{c.system_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {COST_TYPES.find(t => t.value === c.cost_type)?.label || c.cost_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate">{c.description || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium">{formatMoney(c.amount, c.currency)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(c.id)}
                      className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
