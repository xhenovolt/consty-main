'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, RefreshCw, XCircle, Eye, Calendar, CreditCard, Building2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import Link from 'next/link';

const fmtCurrency = (amount, currency = 'UGX') =>
  `${currency} ${parseFloat(amount || 0).toLocaleString()}`;

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_COLORS = {
  active:    'bg-emerald-100 text-emerald-700',
  expired:   'bg-red-100 text-red-600',
  suspended: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-100 text-gray-600',
  trial:     'bg-blue-100 text-blue-700',
};

function NewSubscriptionModal({ onClose, onCreated }) {
  const [clients, setClients]   = useState([]);
  const [plans, setPlans]       = useState([]);
  const [cycles, setCycles]     = useState([]);
  const [form, setForm]         = useState({ client_id: '', plan_id: '', pricing_cycle_id: '', start_date: '', auto_renew: true, notes: '' });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    fetchWithAuth('/api/clients?limit=200').then(r => r.json()).then(j => { if (j.success) setClients(j.data); });
    fetchWithAuth('/api/pricing?active=true&limit=200').then(r => r.json()).then(j => { if (j.success) setPlans(j.data); });
  }, []);

  const handlePlanChange = planId => {
    setForm(f => ({ ...f, plan_id: planId, pricing_cycle_id: '' }));
    const plan = plans.find(p => p.id === planId);
    setCycles(plan?.pricing_cycles?.filter(c => c.is_active) || []);
  };

  const save = async e => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res  = await fetchWithAuth('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || 'Failed to create'); return; }
      onCreated();
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold text-foreground">New Subscription</h2>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 dark:bg-red-900/30 dark:text-red-300">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Client *</label>
            <select required value={form.client_id} onChange={e => setForm(f => ({...f, client_id: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground">
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company_name || c.contact_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Pricing Plan *</label>
            <select required value={form.plan_id} onChange={e => handlePlanChange(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground">
              <option value="">Select plan…</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.system})</option>)}
            </select>
          </div>
          {cycles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Billing Cycle *</label>
              <div className="grid grid-cols-3 gap-2">
                {cycles.map(c => (
                  <button key={c.id} type="button"
                    onClick={() => setForm(f => ({...f, pricing_cycle_id: c.id}))}
                    className={`text-sm rounded-xl border p-3 text-left transition-all ${form.pricing_cycle_id === c.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border hover:border-blue-300'} dark:bg-blue-900/30 dark:text-blue-300`}
                  >
                    <div className="font-medium capitalize">{c.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{fmtCurrency(c.price, c.currency)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Start Date</label>
            <input type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
            <p className="text-xs text-muted-foreground mt-1">Leave blank to use today</p>
          </div>
          <div className="flex items-center gap-3">
            <input id="auto_renew" type="checkbox" checked={form.auto_renew} onChange={e => setForm(f => ({...f, auto_renew: e.target.checked}))} className="rounded" />
            <label htmlFor="auto_renew" className="text-sm text-foreground">Auto-renew</label>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button type="submit" disabled={saving || !form.pricing_cycle_id} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Subscription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SubscriptionsPage() {
  const [subs, setSubs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('active');
  const [systemFilter, setSystem] = useState('');
  const [page, setPage]           = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [showNew, setShowNew]     = useState(false);
  const [error, setError]         = useState('');

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (statusFilter) params.set('status', statusFilter);
      if (systemFilter) params.set('system', systemFilter);
      const res  = await fetchWithAuth(`/api/subscriptions?${params}`);
      const json = await res.json();
      if (json.success) { setSubs(json.data); setPagination(json.pagination); }
      else setError(json.error || 'Failed to load');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }, [statusFilter, systemFilter, page]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const handleRenew = async sub => {
    if (!confirm(`Renew subscription for ${sub.client_name}?`)) return;
    try {
      const res  = await fetchWithAuth(`/api/subscriptions/${sub.id}/renew`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) { setError(json.error); return; }
      fetchSubs();
    } catch { setError('Renewal failed'); }
  };

  const handleCancel = async sub => {
    if (!confirm(`Cancel subscription for ${sub.client_name}? This is irreversible.`)) return;
    try {
      const res  = await fetchWithAuth(`/api/subscriptions/${sub.id}/cancel`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) { setError(json.error); return; }
      fetchSubs();
    } catch { setError('Cancellation failed'); }
  };

  const filtered = subs.filter(s =>
    !search || s.client_name?.toLowerCase().includes(search.toLowerCase()) || s.plan_name?.toLowerCase().includes(search.toLowerCase())
  );

  const today = new Date();
  const expiringSoon = subs.filter(s => {
    const end = new Date(s.end_date);
    const diff = (end - today) / (1000 * 60 * 60 * 24);
    return s.status === 'active' && diff >= 0 && diff <= 14;
  }).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-600" /> Subscriptions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage client subscriptions across all systems</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium shrink-0">
          <Plus className="w-4 h-4" /> New Subscription
        </button>
      </div>

      {expiringSoon > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          ⚠ <strong>{expiringSoon}</strong> subscription{expiringSoon > 1 ? 's' : ''} expiring within 14 days.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex justify-between dark:bg-red-900/30 dark:text-red-300">
          {error}
          <button onClick={() => setError('')} className="font-bold ml-4">×</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total',     value: pagination.total || subs.length, color: 'text-foreground' },
          { label: 'Active',    value: subs.filter(s => s.status === 'active').length,    color: 'text-emerald-600' },
          { label: 'Expired',   value: subs.filter(s => s.status === 'expired').length,   color: 'text-red-600' },
          { label: 'Suspended', value: subs.filter(s => s.status === 'suspended').length, color: 'text-orange-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-card rounded-xl border p-4">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client or plan…" className="border border-border rounded-lg pl-9 pr-3 py-2 text-sm bg-background text-foreground w-56" />
        </div>
        <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
          <option value="trial">Trial</option>
        </select>
        <select value={systemFilter} onChange={e => { setSystem(e.target.value); setPage(1); }} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground">
          <option value="">All systems</option>
          <option value="consty">Consty</option>
          <option value="drais">Drais</option>
          <option value="lypha">Lypha</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No subscriptions found.</div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Client', 'Plan', 'System', 'Cycle', 'End Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(sub => {
                  const end      = new Date(sub.end_date);
                  const daysLeft = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
                  const urgent   = sub.status === 'active' && daysLeft >= 0 && daysLeft <= 7;
                  return (
                    <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{sub.client_name}</div>
                        <div className="text-xs text-muted-foreground">{sub.contact_name}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{sub.plan_name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs capitalize bg-muted px-2 py-0.5 rounded-full">{sub.system}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="capitalize">{sub.cycle_name}</div>
                        <div className="text-xs text-muted-foreground">{fmtCurrency(sub.price, sub.currency)}</div>
                      </td>
                      <td className={`px-4 py-3 ${urgent ? 'text-red-600 font-semibold' : 'text-foreground'}`}>
                        {fmtDate(sub.end_date)}
                        {sub.status === 'active' && daysLeft >= 0 && (
                          <div className="text-xs text-muted-foreground">{daysLeft}d left</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[sub.status] || ''}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/app/subscriptions/${sub.id}`} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="View">
                            <Eye className="w-4 h-4" />
                          </Link>
                          {sub.status !== 'cancelled' && (
                            <button onClick={() => handleRenew(sub)} className="p-1 rounded hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/20" title="Renew">
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          {sub.status !== 'cancelled' && (
                            <button onClick={() => handleCancel(sub)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/20" title="Cancel">
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
              <span>Page {page} of {pagination.totalPages} · {pagination.total} total</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-muted">Prev</button>
                <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-muted">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showNew && (
        <NewSubscriptionModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); fetchSubs(); }} />
      )}
    </div>
  );
}
