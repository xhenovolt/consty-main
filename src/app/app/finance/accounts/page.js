'use client';

import { useEffect, useState } from 'react';
import { Plus, Wallet, X, Pencil, Trash2, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';
import { useToast } from '@/components/ui/Toast';
import { confirmAction } from '@/lib/api-client';

const TYPE_COLORS = {
  bank: 'bg-blue-100 text-blue-700', savings: 'bg-emerald-100 text-emerald-700',
  cash: 'bg-yellow-100 text-yellow-700', mobile_money: 'bg-purple-100 text-purple-700',
  credit_card: 'bg-pink-100 text-pink-700', investment: 'bg-cyan-100 text-cyan-700',
  internal: 'bg-orange-100 text-orange-700', salary: 'bg-teal-100 text-teal-700',
  escrow: 'bg-indigo-100 text-indigo-700', other: 'bg-muted text-foreground',
};
const ACCOUNT_TYPES = ['cash', 'mobile_money', 'bank', 'savings', 'credit_card', 'investment', 'internal', 'salary', 'escrow', 'other'];
const EMPTY_FORM = { name: '', type: 'cash', currency: 'UGX', initial_balance: '', institution: '', account_number: '', description: '' };
const INPUT = 'w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm';

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editAccount, setEditAccount] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // Adjust balance modal
  const [adjustAccount, setAdjustAccount] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ amount: '', reason: '', entry_date: '', direction: 'credit' });
  const [adjustSaving, setAdjustSaving] = useState(false);

  const toast = useToast();

  useEffect(() => { fetchAccounts(); }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/accounts');
      const json = await res.json();
      if (json.success) setAccounts(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  // ─── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const body = { ...form };
      if (body.initial_balance) body.initial_balance = parseFloat(body.initial_balance);
      else delete body.initial_balance;
      const res = await fetchWithAuth('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) {
        toast.success('Account created');
        setShowCreateForm(false);
        setForm(EMPTY_FORM);
        fetchAccounts();
      } else { toast.error(json.error || 'Failed to create account'); }
    } catch (err) { toast.error('Failed to create account'); } finally { setSaving(false); }
  };

  // ─── Edit ────────────────────────────────────────────────────────────────
  const openEdit = (a) => {
    setEditAccount(a);
    setEditForm({ name: a.name, type: a.type, currency: a.currency, institution: a.institution || '', account_number: a.account_number || '', description: a.description || '' });
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setEditSaving(true);
    try {
      const res = await fetchWithAuth(`/api/accounts/${editAccount.account_id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (json.success) { toast.success('Account updated'); setEditAccount(null); fetchAccounts(); }
      else { toast.error(json.error || 'Failed to update'); }
    } catch (err) { toast.error('Failed to update'); } finally { setEditSaving(false); }
  };

  // ─── Disable / Enable ────────────────────────────────────────────────────
  const handleToggle = async (a) => {
    const isActive = a.is_active;
    const ok = await confirmAction({
      title: isActive ? 'Disable Account?' : 'Enable Account?',
      text: isActive ? `"${a.name}" will be blocked from new transactions.` : `"${a.name}" will be re-enabled.`,
      confirmText: isActive ? 'Disable' : 'Enable',
      confirmColor: isActive ? '#dc2626' : '#16a34a',
    });
    if (!ok) return;
    try {
      const res = await fetchWithAuth(`/api/accounts/${a.account_id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isActive ? 'disable' : 'enable' }),
      });
      const json = await res.json();
      if (json.success) { toast.success(isActive ? 'Account disabled' : 'Account enabled'); fetchAccounts(); }
      else { toast.error(json.error || 'Action failed'); }
    } catch { toast.error('Action failed'); }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (a) => {
    const ok = await confirmAction({
      title: 'Delete Account?',
      text: `"${a.name}" will be removed. If it has transaction history it will be disabled instead to preserve audit integrity.`,
      confirmText: 'Delete',
      confirmColor: '#dc2626',
    });
    if (!ok) return;
    try {
      const res = await fetchWithAuth(`/api/accounts/${a.account_id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success(json.message || 'Account deleted'); fetchAccounts(); }
      else { toast.error(json.error || 'Failed to delete'); }
    } catch { toast.error('Delete failed'); }
  };

  // ─── Manual balance adjustment ────────────────────────────────────────────
  const openAdjust = (a) => {
    setAdjustAccount(a);
    setAdjustForm({ amount: '', reason: '', entry_date: new Date().toISOString().split('T')[0], direction: 'credit' });
  };

  const handleAdjust = async (e) => {
    e.preventDefault(); setAdjustSaving(true);
    try {
      const signedAmount = adjustForm.direction === 'debit'
        ? -Math.abs(parseFloat(adjustForm.amount))
        : Math.abs(parseFloat(adjustForm.amount));
      const res = await fetchWithAuth(`/api/accounts/${adjustAccount.account_id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'adjust_balance', amount: signedAmount, reason: adjustForm.reason, entry_date: adjustForm.entry_date }),
      });
      const json = await res.json();
      if (json.success) {
        toast.warning('Balance adjusted — flagged for audit review');
        setAdjustAccount(null); fetchAccounts();
      } else { toast.error(json.error || 'Adjustment failed'); }
    } catch { toast.error('Adjustment failed'); } finally { setAdjustSaving(false); }
  };

  const activeAccounts = accounts.filter(a => a.is_active);
  const totalBalance = activeAccounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeAccounts.length} active · {accounts.length} total · {formatCurrency(totalBalance)} active balance
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreateForm ? 'Cancel' : 'New Account'}
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-card rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">Create Account</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name *">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className={INPUT} placeholder="e.g. Business Checking" />
            </Field>
            <Field label="Type">
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={INPUT}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
            <Field label="Currency">
              <input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className={INPUT} />
            </Field>
            <Field label="Initial Balance">
              <input type="number" step="0.01" value={form.initial_balance} onChange={e => setForm(f => ({ ...f, initial_balance: e.target.value }))} className={INPUT} placeholder="0.00" />
            </Field>
            <Field label="Institution">
              <input value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} className={INPUT} placeholder="Bank or provider name" />
            </Field>
            <Field label="Account Number">
              <input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} className={INPUT} placeholder="Optional" />
            </Field>
          </div>
          <Field label="Description">
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={INPUT + ' h-16 resize-none'} />
          </Field>
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Account'}
          </button>
        </form>
      )}

      {/* Account grid */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No accounts yet. Create your first account to start tracking finances.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(a => (
            <div
              key={a.account_id}
              className={`bg-card rounded-xl border p-5 transition-all ${!a.is_active ? 'opacity-60 border-dashed border-red-200' : 'hover:border-blue-300 hover:shadow-sm'}`}
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Wallet className={`w-5 h-5 flex-shrink-0 ${!a.is_active ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} />
                  <span className="font-medium text-foreground truncate">{a.name}</span>
                  {!a.is_active && (
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0 dark:bg-red-900/30 dark:text-red-300">DISABLED</span>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize flex-shrink-0 ${TYPE_COLORS[a.type] || TYPE_COLORS.other}`}>
                  {a.type?.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Balance */}
              <div className={`text-2xl font-bold ${parseFloat(a.balance) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(a.balance)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{a.currency} · {a.transaction_count || 0} transactions</div>
              {a.institution && <div className="text-xs text-muted-foreground mt-0.5">{a.institution}</div>}

              {/* Action bar */}
              <div className="mt-4 pt-3 border-t border-border flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => openEdit(a)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-muted hover:bg-blue-50 hover:text-blue-700 transition text-muted-foreground dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/20"
                  title="Edit account details"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => openAdjust(a)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-muted hover:bg-amber-50 hover:text-amber-700 transition text-muted-foreground dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/20"
                  title="Manually adjust balance (flagged for audit)"
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Adjust
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => handleToggle(a)}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md transition ${a.is_active ? 'bg-muted hover:bg-orange-50 hover:text-orange-700 text-muted-foreground' : 'bg-green-50 text-green-700 hover:bg-green-100'} dark:bg-green-900/30 dark:text-green-300 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-green-900/20 dark:hover:bg-orange-900/20`}
                  title={a.is_active ? 'Disable account' : 'Enable account'}
                >
                  {a.is_active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                  {a.is_active ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => handleDelete(a)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-muted hover:bg-red-50 hover:text-red-700 transition text-muted-foreground dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/20"
                  title="Delete account"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Edit modal ─────────────────────────────────────────────────────── */}
      {editAccount && (
        <Modal title={`Edit — ${editAccount.name}`} onClose={() => setEditAccount(null)}>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name *">
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required className={INPUT} />
              </Field>
              <Field label="Type">
                <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} className={INPUT}>
                  {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </Field>
              <Field label="Currency">
                <input value={editForm.currency} onChange={e => setEditForm(f => ({ ...f, currency: e.target.value }))} className={INPUT} />
              </Field>
              <Field label="Institution">
                <input value={editForm.institution} onChange={e => setEditForm(f => ({ ...f, institution: e.target.value }))} className={INPUT} placeholder="Bank or provider" />
              </Field>
              <Field label="Account Number" className="md:col-span-2">
                <input value={editForm.account_number} onChange={e => setEditForm(f => ({ ...f, account_number: e.target.value }))} className={INPUT} />
              </Field>
            </div>
            <Field label="Description">
              <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className={INPUT + ' h-16 resize-none'} />
            </Field>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setEditAccount(null)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
              <button type="submit" disabled={editSaving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Adjust balance modal ────────────────────────────────────────────── */}
      {adjustAccount && (
        <Modal title={`Adjust Balance — ${adjustAccount.name}`} onClose={() => setAdjustAccount(null)}>
          {/* Audit warning */}
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <strong>Manual adjustments are permanently flagged for audit.</strong> Every change is recorded with your identity, a timestamp, and the reason you provide. Only use this to correct genuine discrepancies — never to fabricate income or hide expenses.
            </div>
          </div>
          <div className="text-sm text-muted-foreground mb-4">
            Current balance: <span className="font-semibold text-foreground">{formatCurrency(adjustAccount.balance)} {adjustAccount.currency}</span>
          </div>
          <form onSubmit={handleAdjust} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Direction">
                <select value={adjustForm.direction} onChange={e => setAdjustForm(f => ({ ...f, direction: e.target.value }))} className={INPUT}>
                  <option value="credit">Credit ( + increase balance)</option>
                  <option value="debit">Debit ( − decrease balance)</option>
                </select>
              </Field>
              <Field label="Amount *">
                <input type="number" step="0.01" min="0.01" value={adjustForm.amount} onChange={e => setAdjustForm(f => ({ ...f, amount: e.target.value }))} required className={INPUT} placeholder="0.00" />
              </Field>
            </div>
            <Field label="Date">
              <input type="date" value={adjustForm.entry_date} onChange={e => setAdjustForm(f => ({ ...f, entry_date: e.target.value }))} className={INPUT} />
            </Field>
            <Field label="Reason * (minimum 5 characters — required for audit trail)">
              <input
                value={adjustForm.reason}
                onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))}
                required minLength={5}
                className={INPUT}
                placeholder="e.g. Bank reconciliation correction for March 15 discrepancy"
              />
            </Field>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setAdjustAccount(null)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
              <button type="submit" disabled={adjustSaving} className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
                {adjustSaving ? 'Adjusting...' : 'Apply Adjustment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

