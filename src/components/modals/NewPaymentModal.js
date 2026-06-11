'use client';

import { useEffect, useState } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';

export default function NewPaymentModal({ isOpen, onClose, onCreated, prefillDealId }) {
  const toast = useToast();
  const [deals, setDeals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    deal_id: prefillDealId || '', account_id: '', amount: '', currency: 'UGX',
    method: 'cash', reference: '', payment_date: new Date().toISOString().split('T')[0],
    status: 'completed', notes: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    const safeFetch = (url) => fetchWithAuth(url)
      .then(r => r.json())
      .then(j => j.success ? (j.data || []) : [])
      .catch(() => []);

    safeFetch('/api/deals').then(setDeals);
    safeFetch('/api/accounts').then(setAccounts);
  }, [isOpen]);

  // Auto-fill currency from selected deal
  useEffect(() => {
    if (form.deal_id && deals.length) {
      const deal = deals.find(d => d.id === form.deal_id);
      if (deal?.currency) setForm(f => ({ ...f, currency: deal.currency }));
    }
  }, [form.deal_id, deals]);

  const selectedDeal = deals.find(d => d.id === form.deal_id);
  const remaining = selectedDeal ? parseFloat(selectedDeal.total_amount || 0) - parseFloat(selectedDeal.paid_amount || 0) : null;

  const resetForm = () => {
    setForm({
      deal_id: prefillDealId || '', account_id: '', amount: '', currency: 'UGX',
      method: 'cash', reference: '', payment_date: new Date().toISOString().split('T')[0],
      status: 'completed', notes: '',
    });
    setError('');
  };

  const submit = async (e) => {
    e?.preventDefault(); setError('');
    if (!form.deal_id) { setError('Please select a deal'); return; }
    if (!form.account_id) { setError('Please select a destination account'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Payment amount is required'); return; }

    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: form.deal_id, account_id: form.account_id,
          amount: parseFloat(form.amount), currency: form.currency,
          method: form.method, reference: form.reference || null,
          payment_date: form.payment_date, status: form.status,
          notes: form.notes || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Payment recorded');
        resetForm();
        onClose();
        if (onCreated) onCreated(json.data);
      } else setError(json.error || 'Failed to record payment');
    } catch (err) { console.error(err); setError(err.message || 'Network error'); } finally { setSaving(false); }
  };

  const inputClass = 'w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm';
  const selectClass = `${inputClass} [&>option]:bg-background`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment"
      subtitle="Record a payment against a deal"
      size="md"
      footer={
        <div className="flex items-center justify-between">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm">
            <Save className="w-4 h-4" /> {saving ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Deal Select */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Deal *</label>
          <select value={form.deal_id} onChange={e => setForm(f => ({ ...f, deal_id: e.target.value }))} className={selectClass}>
            <option value="">Select a deal...</option>
            {deals.filter(d => d.status !== 'completed' && d.status !== 'cancelled').map(d => (
              <option key={d.id} value={d.id}>{d.title} — {d.client_label || d.client_name || 'Unknown client'} ({d.currency || 'UGX'} {Math.round(parseFloat(d.total_amount || 0)).toLocaleString()})</option>
            ))}
          </select>
          {selectedDeal && remaining !== null && (
            <p className="text-xs text-muted-foreground mt-1">
              Outstanding: {selectedDeal.currency || 'UGX'} {Math.round(remaining).toLocaleString()}
            </p>
          )}
        </div>

        {/* Amount + Currency */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Amount *</label>
            <div className="flex gap-1">
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-[72px] px-1.5 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
                <option value="UGX">UGX</option><option value="USD">USD</option><option value="KES">KES</option>
              </select>
              <input type="number" step="1" min="0" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0" className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Destination Account *</label>
            <select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} className={selectClass}>
              <option value="">Select account...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
            </select>
          </div>
        </div>

        {/* Method + Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Payment Method</label>
            <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} className={selectClass}>
              <option value="cash">Cash</option><option value="mobile_money">Mobile Money</option>
              <option value="bank_transfer">Bank Transfer</option><option value="check">Check</option><option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Payment Date</label>
            <input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} className={inputClass} />
          </div>
        </div>

        {/* Reference */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Reference / Transaction ID</label>
          <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
            placeholder="e.g. MM-12345 or bank ref" className={inputClass} />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
            placeholder="Optional notes..." className={inputClass} />
        </div>
      </div>
    </Modal>
  );
}
