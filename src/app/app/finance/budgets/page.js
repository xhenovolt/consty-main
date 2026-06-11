'use client';

import { useEffect, useState } from 'react';
import { PiggyBank, Plus, X, Edit, Trash2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';

const CATEGORIES = ['office','software','marketing','travel','meals','equipment','professional_services','utilities','rent','insurance','taxes','payroll','other'];

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', category: '', period_start: '', period_end: '' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const fetchBudgets = async () => {
    try { const res = await fetchWithAuth('/api/budgets'); const j = await res.json(); if (j.success) setBudgets(j.data); } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const body = {
        name: form.name,
        amount: parseFloat(form.amount),
        category: form.category || undefined,
        period: 'custom',
        start_date: form.period_start,
        end_date: form.period_end,
      };
      const url = editId ? `/api/budgets/${editId}` : '/api/budgets';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if ((await res.json()).success) { toast.success(editId ? 'Budget updated' : 'Budget created'); setShowForm(false); setEditId(null); setForm({ name: '', amount: '', category: '', period_start: '', period_end: '' }); fetchBudgets(); }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const startEdit = (b) => {
    setForm({ name: b.name, amount: b.amount?.toString() || '', category: b.category || '', period_start: b.period_start?.split('T')[0] || '', period_end: b.period_end?.split('T')[0] || '' });
    setEditId(b.id); setShowForm(true);
  };

  const deleteBudget = async (id) => {
    if (!await confirmDelete('budget')) return;
    try { await fetchWithAuth(`/api/budgets/${id}`, { method: 'DELETE' }); toast.success('Budget deleted'); fetchBudgets(); } catch { toast.error('Failed to delete'); }
  };


  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Budgets</h1>
          <p className="text-sm text-muted-foreground mt-1">{budgets.length} budgets</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', amount: '', category: '', period_start: '', period_end: '' }); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {showForm ? 'Cancel' : 'New Budget'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">{editId ? 'Edit' : 'Create'} Budget</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" placeholder="e.g. Q1 Marketing" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Limit Amount *</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                <option value="">All categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div />
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Period Start *</label>
              <input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} required className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Period End *</label>
              <input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} required className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : editId ? 'Update Budget' : 'Create Budget'}</button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No budgets yet. Set spending limits to track your expenses.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map(b => {
            const limit = parseFloat(b.amount || 0);
            const spent = parseFloat(b.spent || 0);
            const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
            const overBudget = pct > 100;
            return (
              <div key={b.id} className="bg-card rounded-xl border p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PiggyBank className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium text-foreground">{b.name}</span>
                    {b.category && <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground capitalize">{b.category.replace(/_/g,' ')}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(b)} className="p-1 hover:bg-muted rounded"><Edit className="w-4 h-4 text-muted-foreground" /></button>
                    <button onClick={() => deleteBudget(b.id)} className="p-1 hover:bg-red-50 rounded dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-600" /></button>
                  </div>
                </div>
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <span className={`text-lg font-bold ${overBudget ? 'text-red-600' : 'text-foreground'}`}>{formatCurrency(spent)}</span>
                    <span className="text-sm text-muted-foreground"> / {formatCurrency(limit)}</span>
                  </div>
                  <span className={`text-sm font-medium ${overBudget ? 'text-red-600' : pct > 80 ? 'text-orange-600' : 'text-emerald-600'}`}>{pct}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${overBudget ? 'bg-red-500' : pct > 80 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {b.period_start && b.period_end ? `${new Date(b.period_start).toLocaleDateString()} — ${new Date(b.period_end).toLocaleDateString()}` : 'No period set'}
                  {b.expense_count > 0 && ` · ${b.expense_count} expenses`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
