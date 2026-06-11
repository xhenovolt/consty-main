'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, DollarSign, Calendar, CreditCard, Plus, CheckCircle, Clock,
  FileText, X, Edit2, Server, Settings, User, Trash2, Save, AlertTriangle, Eye, Download,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const DEAL_STATUS = {
  draft: 'bg-muted text-foreground', sent: 'bg-blue-100 text-blue-700', accepted: 'bg-cyan-100 text-cyan-700',
  in_progress: 'bg-purple-100 text-purple-700', completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700', disputed: 'bg-orange-100 text-orange-700',
};
const PAY_STATUS = { pending: 'bg-yellow-100 text-yellow-700', completed: 'bg-emerald-100 text-emerald-700', failed: 'bg-red-100 text-red-700', refunded: 'bg-muted text-foreground' };

const fmtCurrency = (amount, currency = 'UGX') => {
  const n = parseFloat(amount || 0);
  if (currency === 'UGX') return `UGX ${n.toLocaleString()}`;
  if (currency === 'USD') return `$${n.toLocaleString()}`;
  return `${currency} ${n.toLocaleString()}`;
};

const METHODS = ['bank_transfer', 'mobile_money', 'cash', 'credit_card', 'check', 'crypto', 'other'];

export default function DealDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', account_id: '', method: 'mobile_money', reference: '', payment_date: new Date().toISOString().split('T')[0], notes: '' });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('payments');
  const [events, setEvents] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [payError, setPayError] = useState('');
  const toast = useToast();

  useEffect(() => { fetchDeal(); fetchAccounts(); fetchTimeline(); fetchInvoices(); }, [id]);

  const fetchDeal = async () => {
    try {
      const res = await fetchWithAuth(`/api/deals/${id}`);
      const json = await res.json();
      if (json.success) setDeal(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchAccounts = async () => {
    try { const res = await fetchWithAuth('/api/accounts'); const j = await res.json(); if (j.success) setAccounts(j.data || []); } catch {}
  };

  const fetchTimeline = async () => {
    try {
      const res = await fetchWithAuth(`/api/events?entity_type=deal&entity_id=${id}`);
      const j = await res.json();
      if (j.success) setEvents(j.data || []);
    } catch { setEvents([]); }
  };

  const fetchInvoices = async () => {
    try {
      const res = await fetchWithAuth(`/api/invoices?deal_id=${id}`);
      const j = res.json ? await res.json() : res;
      if (j.success) setInvoices(j.data || []);
    } catch { setInvoices([]); }
  };

  const updateStatus = async (newStatus) => {
    try {
      const res = await fetchWithAuth(`/api/deals/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
      if ((await res.json()).success) { toast.success(`Status updated to ${newStatus}`); fetchDeal(); }
    } catch (err) { console.error(err); }
  };

  const startEdit = () => {
    setEditForm({
      title: deal.title || '',
      description: deal.description || '',
      total_amount: deal.total_amount || '',
      invoice_number: deal.invoice_number || '',
      start_date: deal.start_date ? new Date(deal.start_date).toISOString().split('T')[0] : '',
      end_date: deal.end_date ? new Date(deal.end_date).toISOString().split('T')[0] : '',
      due_date: deal.due_date ? new Date(deal.due_date).toISOString().split('T')[0] : '',
      notes: deal.notes || '',
      terms: deal.terms || '',
    });
    setEditError('');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!editForm.title?.trim()) { setEditError('Title is required'); return; }
    setEditSaving(true); setEditError('');
    try {
      const body = {};
      if (editForm.title !== deal.title) body.title = editForm.title;
      if (editForm.description !== (deal.description || '')) body.description = editForm.description || null;
      if (editForm.total_amount != deal.total_amount) body.total_amount = parseFloat(editForm.total_amount);
      if (editForm.invoice_number !== (deal.invoice_number || '')) body.invoice_number = editForm.invoice_number || null;
      if (editForm.start_date !== (deal.start_date ? new Date(deal.start_date).toISOString().split('T')[0] : '')) body.start_date = editForm.start_date || null;
      if (editForm.end_date !== (deal.end_date ? new Date(deal.end_date).toISOString().split('T')[0] : '')) body.end_date = editForm.end_date || null;
      if (editForm.due_date !== (deal.due_date ? new Date(deal.due_date).toISOString().split('T')[0] : '')) body.due_date = editForm.due_date || null;
      if (editForm.notes !== (deal.notes || '')) body.notes = editForm.notes || null;
      if (editForm.terms !== (deal.terms || '')) body.terms = editForm.terms || null;

      if (Object.keys(body).length === 0) { setEditing(false); return; }

      const res = await fetchWithAuth(`/api/deals/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) { toast.success('Deal updated'); setEditing(false); fetchDeal(); }
      else setEditError(json.error || 'Failed to update deal');
    } catch { setEditError('Network error'); } finally { setEditSaving(false); }
  };

  const deleteDeal = async () => {
    setDeleting(true);
    try {
      const res = await fetchWithAuth(`/api/deals/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('Deal deleted'); router.push('/app/deals'); }
      else setEditError(json.error || 'Cannot delete deal');
    } catch { setEditError('Failed to delete'); } finally { setDeleting(false); setShowDeleteConfirm(false); }
  };

  const submitPayment = async (e) => {
    e.preventDefault(); setSaving(true); setPayError('');
    try {
      const body = {
        deal_id: id,
        amount: parseFloat(payForm.amount),
        account_id: payForm.account_id,
        method: payForm.method,
        currency: deal.currency || 'UGX',
        status: 'completed',
        payment_date: payForm.payment_date,
        reference: payForm.reference || undefined,
        notes: payForm.notes || undefined,
      };
      const res = await fetchWithAuth('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) {
        toast.success('Payment recorded');
        setShowPayForm(false);
        setPayError('');
        setPayForm({ amount: '', account_id: '', method: 'mobile_money', reference: '', payment_date: new Date().toISOString().split('T')[0], notes: '' });
        fetchDeal(); fetchTimeline(); fetchInvoices();
      } else {
        setPayError(json.error || 'Failed to record payment');
      }
    } catch (err) { console.error(err); setPayError('Network error. Please try again.'); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!deal) return <div className="p-6 text-center text-muted-foreground">Deal not found</div>;

  const cur = deal.currency || 'UGX';
  const paid = parseFloat(deal.paid_amount || 0);
  const total = parseFloat(deal.total_amount || 0);
  const remaining = total - paid;
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const payments = deal.payments || [];

  // Historical deal detection
  const startDate = deal.start_date ? new Date(deal.start_date) : null;
  const daysSinceStart = startDate ? Math.floor((Date.now() - startDate.getTime()) / 86400000) : 0;
  const isHistorical = startDate && daysSinceStart > 90 && deal.status !== 'completed';

  // Overdue detection
  const dueDate = deal.due_date ? new Date(deal.due_date) : null;
  const isOverdue = dueDate && dueDate < new Date() && remaining > 0 && deal.status !== 'completed' && deal.status !== 'cancelled';

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/app/deals')} className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{deal.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{deal.client_label || deal.client_name || 'No client'}</span>
            {deal.system_name && <><span className="text-muted-foreground">·</span><Server className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-sm text-muted-foreground">{deal.system_name}</span></>}
            {deal.service_name && <><span className="text-muted-foreground">·</span><Settings className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-sm text-muted-foreground">{deal.service_name}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${DEAL_STATUS[deal.status] || 'bg-muted text-foreground'}`}>{deal.status?.replace(/_/g, ' ')}</span>
          <button onClick={startEdit} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit deal"><Edit2 className="w-4 h-4" /></button>
          <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600 dark:bg-red-900/30 dark:text-red-300" title="Delete deal"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Warnings */}
      {isHistorical && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Historical deal — started {daysSinceStart} days ago and still open. Consider updating status or recording remaining payments.</span>
        </div>
      )}
      {isOverdue && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Overdue — payment of {fmtCurrency(remaining, cur)} was due {new Date(deal.due_date).toLocaleDateString()}. Follow up with client.</span>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1">Delete this deal? {payments.length > 0 ? 'Deals with completed payments cannot be deleted.' : 'This cannot be undone.'}</span>
          <button onClick={deleteDeal} disabled={deleting} className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
            {deleting ? 'Deleting...' : 'Confirm Delete'}
          </button>
          <button onClick={() => setShowDeleteConfirm(false)} className="text-xs underline">Cancel</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Value', value: fmtCurrency(total, cur), icon: FileText, color: 'text-blue-600' },
          { label: 'Paid', value: fmtCurrency(paid, cur), icon: CheckCircle, color: 'text-emerald-600' },
          { label: 'Balance', value: fmtCurrency(remaining, cur), icon: Clock, color: remaining > 0 ? 'text-orange-600' : 'text-emerald-600' },
          { label: 'Progress', value: `${pct}%`, icon: DollarSign, color: 'text-purple-600' },
        ].map(c => (
          <div key={c.label} className="bg-card rounded-xl border p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><c.icon className="w-3.5 h-3.5" />{c.label}</div>
            <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-card rounded-xl border p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Payment Progress — {payments.length} payment{payments.length !== 1 ? 's' : ''}</span>
          <span className="font-medium">{pct}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {['payments', 'details', 'timeline'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{t}</button>
        ))}
      </div>

      {/* TAB: Payments */}
      {tab === 'payments' && (
        <div className="bg-card rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Payments ({payments.length})</h2>
            {remaining > 0 && (
              <button onClick={() => { setPayForm(f => ({ ...f, amount: remaining.toString() })); setShowPayForm(true); }} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                <Plus className="w-4 h-4" /> Record Payment
              </button>
            )}
          </div>

          {showPayForm && (
            <form onSubmit={submitPayment} className="mb-4 p-4 bg-muted rounded-lg space-y-3">
              <div className="flex justify-between items-center"><span className="text-sm font-medium">Record Payment</span><button type="button" onClick={() => setShowPayForm(false)}><X className="w-4 h-4" /></button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Amount ({cur})*</label>
                  <input type="number" step="0.01" placeholder="Amount" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Receive Into*</label>
                  <select value={payForm.account_id} onChange={e => setPayForm(f => ({ ...f, account_id: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg text-sm bg-background">
                    <option value="">Select account...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Method</label>
                  <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background">
                    {METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Payment Date</label>
                  <input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Reference</label>
                  <input placeholder="e.g. TXN-123456" value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Notes</label>
                  <input placeholder="Optional" value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
                </div>
              </div>
              {parseFloat(payForm.amount) > remaining && <p className="text-xs text-red-500">Warning: Amount exceeds remaining balance of {fmtCurrency(remaining, cur)}</p>}
              {payError && <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{payError}</p>}
              <button type="submit" disabled={saving} className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Recording...' : `Record ${fmtCurrency(payForm.amount || 0, cur)} Payment`}</button>
            </form>
          )}

          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No payments recorded yet</p>
          ) : (
            <div className="divide-y">
              {payments.map(p => {
                const inv = invoices.find(i => i.payment_id === p.id);
                return (
                <div key={p.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{fmtCurrency(p.amount, cur)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${PAY_STATUS[p.status] || 'bg-muted text-foreground'}`}>{p.status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 ml-6">
                        {p.method?.replace(/_/g, ' ')} {p.reference && `· Ref: ${p.reference}`} · {new Date(p.payment_date || p.created_at).toLocaleDateString()}
                        {p.notes && <span className="italic ml-1">— {p.notes}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.ledger_entry_id && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Ledger</span>}
                    </div>
                  </div>
                  {inv && (
                    <div className="ml-6 mt-2 flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Invoice: {inv.invoice_number}</span>
                      <div className="flex items-center gap-1 ml-auto">
                        <button onClick={() => window.open(`/api/invoices/${inv.id}/pdf`, '_blank')}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </button>
                        <span className="text-muted-foreground">·</span>
                        <button onClick={() => window.open(`/api/invoices/${inv.id}/pdf`, '_blank')}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                          <Download className="w-3.5 h-3.5" /> Download
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Details */}
      {tab === 'details' && (
        <div className="bg-card rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Deal Details</h2>
            {!editing && <button onClick={startEdit} className="flex items-center gap-1 text-sm text-blue-600 hover:underline"><Edit2 className="w-3.5 h-3.5" /> Edit</button>}
          </div>

          {editError && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg text-sm">
              <AlertTriangle className="w-3.5 h-3.5" /> {editError}
            </div>
          )}

          {editing ? (
            /* ─── EDIT FORM ─── */
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Title *</label>
                <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Total Amount ({cur})</label>
                  <input type="number" step="1" value={editForm.total_amount} onChange={e => setEditForm(f => ({ ...f, total_amount: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Invoice Number</label>
                  <input value={editForm.invoice_number} onChange={e => setEditForm(f => ({ ...f, invoice_number: e.target.value }))}
                    placeholder="e.g. INV-001" className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Start Date</label>
                  <input type="date" value={editForm.start_date} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">End Date</label>
                  <input type="date" value={editForm.end_date} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Due Date</label>
                  <input type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Terms</label>
                <textarea value={editForm.terms} onChange={e => setEditForm(f => ({ ...f, terms: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={editSaving}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  <Save className="w-4 h-4" /> {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80">Cancel</button>
              </div>
            </div>
          ) : (
            /* ─── READ-ONLY VIEW ─── */
            <>
              {deal.description && <p className="text-sm text-muted-foreground">{deal.description}</p>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">General</h3>
                  <div className="flex justify-between"><span className="text-muted-foreground">Deal Type</span><span>{deal.system_name ? 'System' : deal.service_name ? 'Service' : 'General'}</span></div>
                  {deal.system_name && <div className="flex justify-between"><span className="text-muted-foreground">System</span><span>{deal.system_name}</span></div>}
                  {deal.service_name && <div className="flex justify-between"><span className="text-muted-foreground">Service</span><span>{deal.service_name}</span></div>}
                  {deal.offering_name && <div className="flex justify-between"><span className="text-muted-foreground">Offering</span><span>{deal.offering_name}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span>{cur}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{new Date(deal.created_at).toLocaleDateString()}</span></div>
                  {deal.start_date && <div className="flex justify-between"><span className="text-muted-foreground">Start Date</span><span>{new Date(deal.start_date).toLocaleDateString()}</span></div>}
                  {deal.end_date && <div className="flex justify-between"><span className="text-muted-foreground">End Date</span><span>{new Date(deal.end_date).toLocaleDateString()}</span></div>}
                  {deal.due_date && <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span><span className={isOverdue ? 'text-red-600 font-medium' : ''}>{new Date(deal.due_date).toLocaleDateString()}{isOverdue ? ' (OVERDUE)' : ''}</span></div>}
                  {deal.closed_at && <div className="flex justify-between"><span className="text-muted-foreground">Closed</span><span>{new Date(deal.closed_at).toLocaleDateString()}</span></div>}
                </div>
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pricing</h3>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Amount</span><span className="font-medium">{fmtCurrency(total, cur)}</span></div>
                  {deal.original_price && <div className="flex justify-between"><span className="text-muted-foreground">Original Price</span><span>{fmtCurrency(deal.original_price, cur)}</span></div>}
                  {deal.negotiated_price && <div className="flex justify-between"><span className="text-muted-foreground">Negotiated Price</span><span>{fmtCurrency(deal.negotiated_price, cur)}</span></div>}
                  {deal.original_price && deal.negotiated_price && parseFloat(deal.negotiated_price) < parseFloat(deal.original_price) && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-emerald-600">{fmtCurrency(parseFloat(deal.original_price) - parseFloat(deal.negotiated_price), cur)}</span></div>
                  )}
                  {deal.installation_fee && parseFloat(deal.installation_fee) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Installation Fee</span><span>{fmtCurrency(deal.installation_fee, cur)}</span></div>}
                  {deal.invoice_number && <div className="flex justify-between"><span className="text-muted-foreground">Invoice #</span><span className="font-mono">{deal.invoice_number}</span></div>}
                  {deal.notes && <div className="pt-2 border-t"><span className="text-xs text-muted-foreground">Notes</span><p className="text-sm mt-1">{deal.notes}</p></div>}
                  {deal.terms && <div className="pt-2 border-t"><span className="text-xs text-muted-foreground">Terms</span><p className="text-sm mt-1">{deal.terms}</p></div>}
                </div>
              </div>

              {/* License info */}
              {deal.license && (
                <div className="pt-4 border-t">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">License</h3>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium dark:bg-emerald-900/30 dark:text-emerald-300">{deal.license.status}</span>
                    <span className="text-sm">{deal.license.license_type} · Issued {new Date(deal.license.issued_date).toLocaleDateString()}</span>
                    {deal.license.license_key && <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{deal.license.license_key}</span>}
                  </div>
                </div>
              )}

              {/* Manual Status Override */}
              <div className="pt-4 border-t">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Manual Status Override</h3>
                <p className="text-xs text-muted-foreground mb-2">Status auto-updates with payments. Override only when needed.</p>
                <div className="flex gap-2 flex-wrap">
                  {['draft', 'in_progress', 'completed', 'cancelled'].map(s => (
                    <button key={s} onClick={() => updateStatus(s)} disabled={deal.status === s}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${deal.status === s ? 'bg-blue-600 text-white' : 'bg-muted text-foreground hover:bg-muted/80'}`}>
                      {s.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB: Timeline */}
      {tab === 'timeline' && (
        <div className="bg-card rounded-xl border p-5">
          <h2 className="font-semibold text-foreground mb-4">Timeline</h2>
          {events.length === 0 && payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No events recorded</p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              {[
                ...payments.map(p => ({ type: 'payment', date: p.payment_date || p.created_at, data: p })),
                ...events.map(e => ({ type: 'event', date: e.created_at, data: e })),
                { type: 'event', date: deal.created_at, data: { event_type: 'system', description: 'Deal created' } },
              ]
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map((item, i) => (
                  <div key={i} className="relative pl-10 pb-4">
                    <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 border-background ${item.type === 'payment' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                    <div className="text-xs text-muted-foreground">{new Date(item.date).toLocaleString()}</div>
                    {item.type === 'payment' ? (
                      <div className="text-sm">
                        <span className="font-medium text-emerald-600">Payment received:</span> {fmtCurrency(item.data.amount, cur)}
                        {item.data.method && <span className="text-muted-foreground"> via {item.data.method.replace(/_/g, ' ')}</span>}
                      </div>
                    ) : (
                      <div className="text-sm">{item.data.description || item.data.event_type}</div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
