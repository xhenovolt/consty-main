'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Activity, Truck, Search, Wifi, Megaphone, Wrench, DollarSign, Pencil, Trash2, AlertCircle, Link } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';

const CATEGORIES = [
  { value: 'transport', label: 'Transport', icon: Truck, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'prospecting', label: 'Prospecting', icon: Search, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'internet_data', label: 'Internet/Data', icon: Wifi, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'marketing', label: 'Marketing', icon: Megaphone, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  { value: 'equipment', label: 'Equipment', icon: Wrench, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { value: 'salary', label: 'Salary', icon: DollarSign, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'office', label: 'Office', icon: Activity, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { value: 'utilities', label: 'Utilities', icon: Activity, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  { value: 'communication', label: 'Communication', icon: Activity, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'other', label: 'Other', icon: Activity, color: 'bg-muted text-muted-foreground' },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function fmt(amount, currency) {
  return `${currency || 'UGX'} ${Math.round(parseFloat(amount || 0)).toLocaleString()}`;
}

const emptyForm = {
  title: '', category: 'other', expense_type: 'operational', amount: '', currency: 'UGX',
  account_id: '', operation_date: new Date().toISOString().split('T')[0],
  vendor: '', related_system_id: '', related_deal_id: '', description: '', notes: '',
};

export default function OperationsPage() {
  const [ops, setOps] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [systems, setSystems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [catFilter, setCatFilter] = useState('');
  const [expenseFilter, setExpenseFilter] = useState(''); // '' | 'with' | 'without'
  const [form, setForm] = useState(emptyForm);
  const toast = useToast();

  const fetchOps = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/operations?limit=200';
      if (catFilter) url += `&category=${catFilter}`;
      if (expenseFilter === 'with') url += '&has_expense=true';
      if (expenseFilter === 'without') url += '&has_expense=false';
      const res = await fetchWithAuth(url);
      if (res.success) {
        setOps(res.data || []);
        setStats(res.stats || {});
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [catFilter, expenseFilter]);

  useEffect(() => { fetchOps(); }, [fetchOps]);

  useEffect(() => {
    fetchWithAuth('/api/systems').then(r => { if (r.success) setSystems(r.data || r.systems || []); }).catch(() => {});
    fetchWithAuth('/api/accounts').then(r => { if (r.success) setAccounts(r.data || []); }).catch(() => {});
    fetchWithAuth('/api/deals').then(r => { if (r.success) setDeals(r.data || []); }).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        amount: form.amount ? parseFloat(form.amount) : null,
        account_id: form.account_id || null,
        related_system_id: form.related_system_id || null,
        related_deal_id: form.related_deal_id || null,
        vendor: form.vendor || null,
        notes: form.notes || null,
        description: form.description || null,
      };

      let res;
      if (editId) {
        res = await fetchWithAuth('/api/operations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editId, ...body }),
        });
      } else {
        res = await fetchWithAuth('/api/operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (res.success) {
        setForm(emptyForm);
        setShowForm(false);
        setEditId(null);
        toast.success(editId ? 'Operation updated' : 'Operation logged');
        fetchOps();
      } else {
        toast.error(res.error || 'Failed');
      }
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const startEdit = (op) => {
    setForm({
      title: op.title || '', category: op.category || 'other',
      expense_type: op.expense_type || 'operational',
      amount: op.amount ? String(op.amount) : '',
      currency: op.currency || 'UGX',
      account_id: op.account_id || '',
      operation_date: op.operation_date ? op.operation_date.split('T')[0] : '',
      vendor: op.vendor || '', related_system_id: op.related_system_id || '',
      related_deal_id: op.related_deal_id || '',
      description: op.description || '', notes: op.notes || '',
    });
    setEditId(op.id);
    setShowForm(true);
  };

  const deleteOp = async (id) => {
    if (!await confirmDelete('operation')) return;
    await fetchWithAuth(`/api/operations?id=${id}`, { method: 'DELETE' });
    toast.success('Operation deleted');
    fetchOps();
  };

  // Link expense to existing operation (open edit with cursor in amount field)
  const linkExpense = (op) => {
    startEdit(op);
    // The form will be shown, user can fill amount + account
  };

  const withoutExpense = ops.filter(o => !o.amount || parseFloat(o.amount) === 0);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Founder Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total || ops.length} logged · {stats.today_count || 0} today · {fmt(stats.month_spent || 0)} this month
          </p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm(emptyForm); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition">
          <Plus className="w-4 h-4" /> {showForm ? 'Cancel' : 'Log Operation'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-card rounded-xl border p-3">
          <p className="text-xs font-medium opacity-60 uppercase">Total Ops</p>
          <p className="text-2xl font-bold mt-1">{stats.total || 0}</p>
        </div>
        <div className="bg-card rounded-xl border p-3">
          <p className="text-xs font-medium opacity-60 uppercase">Total Spent</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{fmt(stats.total_spent || 0)}</p>
        </div>
        <div className="bg-card rounded-xl border p-3">
          <p className="text-xs font-medium opacity-60 uppercase">This Month</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{fmt(stats.month_spent || 0)}</p>
          <p className="text-xs opacity-50">{stats.month_count || 0} ops</p>
        </div>
        <div className="bg-card rounded-xl border p-3">
          <p className="text-xs font-medium opacity-60 uppercase">With Expense</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.with_expense || 0}</p>
        </div>
        <div className={`rounded-xl border p-3 ${parseInt(stats.without_expense || 0) > 0 ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-card'}`}>
          <p className="text-xs font-medium opacity-60 uppercase">No Expense</p>
          <p className={`text-2xl font-bold mt-1 ${parseInt(stats.without_expense || 0) > 0 ? 'text-amber-600' : ''}`}>{stats.without_expense || 0}</p>
          {parseInt(stats.without_expense || 0) > 0 && (
            <p className="text-xs text-amber-600">needs linking</p>
          )}
        </div>
      </div>

      {/* Founder alert: ops without expense */}
      {withoutExpense.length > 0 && !showForm && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="font-medium text-amber-800 dark:text-amber-200 text-sm">
              {withoutExpense.length} operation{withoutExpense.length > 1 ? 's' : ''} without expense records
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {withoutExpense.slice(0, 5).map(op => (
              <button key={op.id} onClick={() => linkExpense(op)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-white dark:bg-gray-800 border text-xs hover:bg-amber-100 dark:hover:bg-amber-900/30 transition">
                <Link className="w-3 h-3" /> {op.title}
              </button>
            ))}
            {withoutExpense.length > 5 && <span className="text-xs text-amber-600 self-center">+{withoutExpense.length - 5} more</span>}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <button onClick={() => setCatFilter('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!catFilter ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>All</button>
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setCatFilter(catFilter === c.value ? '' : c.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${catFilter === c.value ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>{c.label}</button>
        ))}
        <span className="w-px h-5 bg-border mx-1" />
        <button onClick={() => setExpenseFilter(expenseFilter === 'without' ? '' : 'without')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${expenseFilter === 'without' ? 'bg-amber-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>No Expense</button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">{editId ? 'Edit Operation' : 'Log Operation / Expense'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium opacity-70 mb-1">Title *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Taxi to Nakawa client"
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium opacity-70 mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium opacity-70 mb-1">Date</label>
              <input type="date" value={form.operation_date} onChange={e => setForm(f => ({ ...f, operation_date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium opacity-70 mb-1">Amount</label>
              <div className="flex gap-1">
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-16 px-1 py-2 border rounded-lg bg-background text-xs">
                  <option value="UGX">UGX</option><option value="USD">USD</option><option value="KES">KES</option>
                </select>
                <input type="number" step="1" min="0" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0"
                  className="flex-1 px-3 py-2 border rounded-lg bg-background text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium opacity-70 mb-1">Pay from Account</label>
              <select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="">— Cash/untracked —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium opacity-70 mb-1">Vendor / Payee</label>
              <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
                placeholder="e.g. Boda rider, MTN"
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium opacity-70 mb-1">Related System</label>
              <select value={form.related_system_id} onChange={e => setForm(f => ({ ...f, related_system_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="">— None —</option>
                {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium opacity-70 mb-1">Related Deal</label>
              <select value={form.related_deal_id} onChange={e => setForm(f => ({ ...f, related_deal_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="">— None —</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium opacity-70 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              placeholder="Additional context..."
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition">
              {saving ? 'Saving…' : editId ? 'Update Operation' : 'Log Operation'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}
              className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition">Cancel</button>
          </div>
        </form>
      )}

      {/* Operations List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : ops.length === 0 ? (
        <div className="text-center py-16 opacity-50">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No operations logged yet</p>
          <p className="text-sm mt-1">Track transport, prospecting, data purchases, marketing, and all founder activity</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border divide-y">
          {ops.map(op => {
            const cat = CAT_MAP[op.category || op.operation_type] || CAT_MAP.other;
            const Icon = cat.icon;
            const hasExpense = op.amount && parseFloat(op.amount) > 0;
            return (
              <div key={op.id} className={`flex items-start gap-3 p-4 hover:bg-muted/30 transition ${!hasExpense ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''}`}>
                <div className={`p-2 rounded-lg shrink-0 ${cat.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{op.title || op.description}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.color}`}>{cat.label}</span>
                    {op.system_name && <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{op.system_name}</span>}
                    {op.deal_title && <span className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">{op.deal_title}</span>}
                    {!hasExpense && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">no expense</span>}
                    {op.ledger_entry_id && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">ledger ✓</span>}
                  </div>
                  {op.description && op.description !== op.title && (
                    <p className="text-xs opacity-50 mt-0.5">{op.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs opacity-50 flex-wrap">
                    {hasExpense && <span className="text-orange-600 font-semibold">{fmt(op.amount, op.currency)}</span>}
                    {op.vendor && <span>→ {op.vendor}</span>}
                    {op.account_name && <span>from {op.account_name}</span>}
                    {op.notes && <span className="truncate max-w-xs">· {op.notes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="text-xs opacity-50 text-right mr-2">
                    {timeAgo(op.operation_date || op.created_at)}
                  </div>
                  {!hasExpense && (
                    <button onClick={() => linkExpense(op)} title="Link expense"
                      className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 transition dark:bg-amber-900/30 dark:text-amber-300">
                      <Link className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => startEdit(op)} title="Edit"
                    className="p-1.5 rounded hover:bg-muted transition">
                    <Pencil className="w-3.5 h-3.5 opacity-50" />
                  </button>
                  <button onClick={() => deleteOp(op.id)} title="Delete"
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
