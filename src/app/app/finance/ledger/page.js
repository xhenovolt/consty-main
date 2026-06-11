'use client';

import { useEffect, useState } from 'react';
import { BookOpen, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';

export default function LedgerPage() {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ account_id: '', type: '', start_date: '', end_date: '' });
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    fetchWithAuth('/api/accounts').then(r => r.json()).then(j => { if (j.success) setAccounts(j.data); }).catch(() => {});
  }, []);

  useEffect(() => { fetchLedger(); }, [filters.account_id, filters.type]);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.account_id) params.set('account_id', filters.account_id);
      if (filters.type) params.set('type', filters.type);
      if (filters.start_date) params.set('start_date', filters.start_date);
      if (filters.end_date) params.set('end_date', filters.end_date);
      params.set('limit', '200');
      const res = await fetchWithAuth(`/api/ledger?${params}`);
      const json = await res.json();
      if (json.success) { setEntries(json.data); setSummary(json.summary || null); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };


  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ledger</h1>
        <p className="text-sm text-muted-foreground mt-1">Immutable transaction history — the single source of truth</p>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border p-4">
            <div className="text-xs text-muted-foreground mb-1">Credits (Income)</div>
            <div className="text-xl font-bold text-emerald-600">{formatCurrency(summary.total_credits)}</div>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <div className="text-xs text-muted-foreground mb-1">Debits (Outflow)</div>
            <div className="text-xl font-bold text-red-600">{formatCurrency(summary.total_debits)}</div>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <div className="text-xs text-muted-foreground mb-1">Net</div>
            <div className={`text-xl font-bold ${parseFloat(summary.net) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(summary.net)}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Account</label>
          <select value={filters.account_id} onChange={e => setFilters(f => ({ ...f, account_id: e.target.value }))} className="px-3 py-1.5 border border-border rounded-lg text-sm bg-background text-foreground">
            <option value="">All accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Type</label>
          <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} className="px-3 py-1.5 border border-border rounded-lg text-sm bg-background text-foreground">
            <option value="">All types</option>
            {['payment','expense','transfer','adjustment','initial_balance'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">From</label>
          <input type="date" value={filters.start_date} onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))} className="px-3 py-1.5 border border-border rounded-lg text-sm bg-background text-foreground" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">To</label>
          <input type="date" value={filters.end_date} onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))} className="px-3 py-1.5 border border-border rounded-lg text-sm bg-background text-foreground" />
        </div>
        <button onClick={fetchLedger} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Apply</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No ledger entries found</div>
      ) : (
        <div className="bg-card rounded-xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-muted border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Account</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map(e => {
                const amt = parseFloat(e.amount);
                const isCredit = amt > 0;
                return (
                  <tr key={e.id} className="hover:bg-muted">
                    <td className="px-4 py-3 text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-foreground">{e.description || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.account_name || '—'}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground capitalize">{e.type?.replace(/_/g,' ')}</span></td>
                    <td className={`px-4 py-3 text-right font-medium ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                      <span className="inline-flex items-center gap-1">
                        {isCredit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {formatCurrency(amt)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
