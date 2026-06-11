'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Monitor, Layers, Users, Plus, CreditCard, DollarSign, AlertTriangle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

function fmtCurrency(amount, currency = 'UGX') {
  return `${currency} ${Math.round(parseFloat(amount || 0)).toLocaleString()}`;
}
const fmt = fmtCurrency;

export default function NewDealPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillSystemId = searchParams.get('system_id');

  const [clients, setClients] = useState([]);
  const [systems, setSystems] = useState([]);
  const [services, setServices] = useState([]);
  const [plans, setPlans] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dealType, setDealType] = useState(prefillSystemId ? 'system' : 'system');
  const [clientMode, setClientMode] = useState('select');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);
  const toast = useToast();

  const [form, setForm] = useState({
    client_id: '', system_id: prefillSystemId || '', service_id: '', plan_id: '',
    title: '', description: '', total_amount: '', negotiated_price: '', installation_fee: '',
    currency: 'UGX', start_date: new Date().toISOString().split('T')[0],
  });

  const [includePayment, setIncludePayment] = useState(false);
  const [payment, setPayment] = useState({
    amount: '', account_id: '', method: 'cash',
    payment_date: new Date().toISOString().split('T')[0], notes: '',
  });

  useEffect(() => {
    const safeFetch = (url) => fetchWithAuth(url)
      .then(r => r.json())
      .then(j => { console.log(`[deals/new] ${url}:`, j); return j.success ? (j.data || []) : []; })
      .catch(err => { console.error(`[deals/new] ${url} failed:`, err); return []; });

    safeFetch('/api/clients').then(d => setClients(d));
    safeFetch('/api/systems').then(d => setSystems(d));
    safeFetch('/api/services').then(d => setServices(d));
    safeFetch('/api/accounts').then(d => setAccounts(d));
  }, []);

  useEffect(() => {
    if (form.system_id) {
      fetchWithAuth(`/api/systems/${form.system_id}/plans`)
        .then(r => r.json()).then(j => setPlans(j.data || [])).catch(() => setPlans([]));
    } else { setPlans([]); setForm(f => ({ ...f, plan_id: '' })); }
  }, [form.system_id]);

  const handlePlanSelect = (planId) => {
    setForm(f => ({ ...f, plan_id: planId }));
    if (planId) {
      const plan = plans.find(p => p.id === planId);
      if (plan) {
        const price = parseFloat(plan.annual_fee || 0) || (parseFloat(plan.monthly_fee || 0) * 12) || 0;
        const install = parseFloat(plan.installation_fee || 0);
        setForm(f => ({
          ...f,
          total_amount: price ? price.toString() : f.total_amount,
          installation_fee: install ? install.toString() : f.installation_fee,
          title: f.title || `${systems.find(s => s.id === f.system_id)?.name || 'System'} — ${plan.name}`,
        }));
      }
    }
  };

  const handleServiceSelect = (serviceId) => {
    setForm(f => ({ ...f, service_id: serviceId }));
    if (serviceId) {
      const svc = services.find(s => s.id === serviceId);
      if (svc) {
        setForm(f => ({
          ...f,
          total_amount: svc.price ? svc.price.toString() : f.total_amount,
          currency: svc.currency || f.currency,
          title: f.title || svc.name,
        }));
      }
    }
  };

  const createClient = async () => {
    if (!newClientName.trim()) return;
    setCreatingClient(true);
    try {
      const res = await fetchWithAuth('/api/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: newClientName.trim(), phone: newClientPhone || null }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Client created');
        setClients(prev => [json.data, ...prev]);
        setForm(f => ({ ...f, client_id: json.data.id }));
        setClientMode('select'); setNewClientName(''); setNewClientPhone('');
      } else { setError(json.error || 'Failed to create client'); }
    } catch { setError('Failed to create client'); } finally { setCreatingClient(false); }
  };

  const dealValue = parseFloat(form.total_amount || 0);
  const negotiated = parseFloat(form.negotiated_price || 0);
  const installFee = parseFloat(form.installation_fee || 0);
  const effectiveTotal = (negotiated || dealValue) + installFee;
  const initialPayment = includePayment ? parseFloat(payment.amount || 0) : 0;
  const openingBalance = effectiveTotal - initialPayment;

  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (!form.client_id) { setError('Please select or create a client'); return; }
    if (!form.title) { setError('Deal title is required'); return; }
    if (!dealValue && !negotiated) { setError('Deal value is required'); return; }
    if (dealType === 'system' && !form.system_id) { setError('Please select a system'); return; }
    if (dealType === 'service' && !form.service_id) { setError('Please select a service'); return; }
    if (includePayment && !payment.amount) { setError('Payment amount is required'); return; }
    if (includePayment && !payment.account_id) { setError('Select which account receives the payment'); return; }
    if (initialPayment > effectiveTotal) { setError('Payment cannot exceed deal value'); return; }

    setSaving(true);
    try {
      const body = {
        client_id: form.client_id,
        system_id: dealType === 'system' ? form.system_id : null,
        service_id: dealType === 'service' ? form.service_id : null,
        plan_id: form.plan_id || null,
        title: form.title, description: form.description || null,
        total_amount: effectiveTotal,
        original_price: dealValue || null, negotiated_price: negotiated || null,
        installation_fee: installFee || null, currency: form.currency,
        status: 'draft', start_date: form.start_date || null,
      };
      if (includePayment && initialPayment > 0) {
        body.initial_payment = {
          amount: initialPayment, account_id: payment.account_id,
          method: payment.method, payment_date: payment.payment_date, notes: payment.notes || null,
        };
      }
      const res = await fetchWithAuth('/api/deals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = res.json ? await res.json() : res;
      if (json.success) { toast.success('Deal created'); router.push(`/app/deals/${json.data.id}`); }
      else setError(json.error || 'Failed to create deal');
    } catch (err) { console.error(err); setError(err.message || 'Network error'); } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/app/deals')} className="p-1.5 rounded-lg hover:bg-muted transition">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Deal</h1>
          <p className="text-sm text-muted-foreground">Record a licensing sale or service engagement</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-6">
        {/* ── SECTION 1: DEAL INFORMATION ── */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-500" /> Deal Information
          </h2>

          {/* Deal Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Deal Type</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setDealType('system'); setForm(f => ({ ...f, service_id: '' })); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition ${dealType === 'system' ? 'bg-blue-600 text-white border-blue-600' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                <Monitor className="w-4 h-4" /> System License
              </button>
              <button type="button" onClick={() => { setDealType('service'); setForm(f => ({ ...f, system_id: '', plan_id: '' })); setPlans([]); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition ${dealType === 'service' ? 'bg-blue-600 text-white border-blue-600' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                <Layers className="w-4 h-4" /> Service Engagement
              </button>
            </div>
          </div>

          {/* System Select */}
          {dealType === 'system' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">System *</label>
                <select value={form.system_id} onChange={e => setForm(f => ({ ...f, system_id: e.target.value, plan_id: '' }))} required
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground [&>option]:bg-background">
                  <option value="">Select a system...</option>
                  {systems.map(s => <option key={s.id} value={s.id}>{s.name}{s.version ? ` v${s.version}` : ''}{s.description ? ` — ${s.description}` : ''}</option>)}
                </select>
              </div>
              {form.system_id && plans.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Pricing Plan (optional)</label>
                  <select value={form.plan_id} onChange={e => handlePlanSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground [&>option]:bg-background">
                    <option value="">Custom pricing</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {p.monthly_fee ? fmt(p.monthly_fee, p.currency) + '/mo' : ''} {p.annual_fee ? fmt(p.annual_fee, p.currency) + '/yr' : ''}</option>)}
                  </select>
                </div>
              )}
              {form.system_id && <p className="text-xs text-blue-600 dark:text-blue-400">A license will be auto-issued when this deal is completed</p>}
            </div>
          )}

          {/* Service Select */}
          {dealType === 'service' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Service *</label>
              <select value={form.service_id} onChange={e => handleServiceSelect(e.target.value)} required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground [&>option]:bg-background">
                <option value="">Select a service...</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.service_type === 'recurring' ? 'Recurring' : 'One-Time'}){s.price ? ` — ${s.currency || 'UGX'} ${Math.round(parseFloat(s.price)).toLocaleString()}` : ''}</option>)}
              </select>
            </div>
          )}

          {/* Client */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-foreground"><Users className="w-4 h-4 inline mr-1" />Client *</label>
              <button type="button" onClick={() => setClientMode(m => m === 'select' ? 'create' : 'select')}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                {clientMode === 'select' ? <><Plus className="w-3 h-3" /> Create new client</> : 'Choose from list'}
              </button>
            </div>
            {clientMode === 'select' ? (
              <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground [&>option]:bg-background">
                <option value="">Select a client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}{c.contact_name ? ` (${c.contact_name})` : ''}</option>)}
              </select>
            ) : (
              <div className="flex gap-2">
                <input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Company name *"
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
                <input value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} placeholder="Phone"
                  className="w-36 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
                <button type="button" onClick={createClient} disabled={creatingClient || !newClientName.trim()}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition whitespace-nowrap">
                  {creatingClient ? '...' : 'Add'}
                </button>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Deal Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Drais Professional — Kampala Logistics"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes / Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              placeholder="Deal terms, scope, or context..."
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Deal Value *</label>
              <div className="flex gap-2">
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-20 px-2 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
                  <option value="UGX">UGX</option><option value="USD">USD</option><option value="KES">KES</option>
                </select>
                <input type="number" step="1" min="0" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                  placeholder="0" className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Negotiated Price</label>
              <input type="number" step="1" min="0" value={form.negotiated_price} onChange={e => setForm(f => ({ ...f, negotiated_price: e.target.value }))}
                placeholder="Optional" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Installation Fee</label>
              <input type="number" step="1" min="0" value={form.installation_fee} onChange={e => setForm(f => ({ ...f, installation_fee: e.target.value }))}
                placeholder="Optional" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
          </div>

          {/* Effective Total */}
          {effectiveTotal > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm">
              <div className="flex justify-between text-foreground"><span>Effective Deal Value:</span><span className="font-bold">{fmt(effectiveTotal, form.currency)}</span></div>
              {negotiated > 0 && negotiated !== dealValue && (
                <div className="flex justify-between text-muted-foreground text-xs mt-1">
                  <span>Original: {fmt(dealValue, form.currency)}</span><span>Discount: {fmt(dealValue - negotiated, form.currency)}</span>
                </div>
              )}
              {installFee > 0 && <div className="text-xs text-muted-foreground mt-1">Includes {fmt(installFee, form.currency)} installation fee</div>}
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Start / Closing Date</label>
            <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              className="w-full sm:w-48 px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
          </div>
        </div>

        {/* ── SECTION 2: INITIAL PAYMENT (OPTIONAL) ── */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-500" /> Initial Payment
            </h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includePayment} onChange={e => setIncludePayment(e.target.checked)} className="rounded border-border" />
              <span className="text-sm text-muted-foreground">Record payment now</span>
            </label>
          </div>

          {!includePayment ? (
            <p className="text-sm text-muted-foreground">No payment will be recorded. The full deal value will remain as outstanding balance.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Payment Amount *</label>
                  <input type="number" step="1" min="0" value={payment.amount} onChange={e => setPayment(f => ({ ...f, amount: e.target.value }))}
                    placeholder="Amount received" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Destination Account *</label>
                  <select value={payment.account_id} onChange={e => setPayment(f => ({ ...f, account_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground [&>option]:bg-background">
                    <option value="">Select account...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Payment Method</label>
                  <select value={payment.method} onChange={e => setPayment(f => ({ ...f, method: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground [&>option]:bg-background">
                    <option value="cash">Cash</option><option value="mobile_money">Mobile Money</option>
                    <option value="bank_transfer">Bank Transfer</option><option value="check">Check</option><option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Payment Date</label>
                  <input type="date" value={payment.payment_date} onChange={e => setPayment(f => ({ ...f, payment_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
                </div>
              </div>
              <input value={payment.notes} onChange={e => setPayment(f => ({ ...f, notes: e.target.value }))}
                placeholder="Payment notes (optional)" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />

              {effectiveTotal > 0 && initialPayment > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Deal Value</span><span className="text-foreground font-medium">{fmt(effectiveTotal, form.currency)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Initial Payment</span><span className="text-emerald-600 font-medium">- {fmt(initialPayment, form.currency)}</span></div>
                  <div className="border-t border-border pt-1 flex justify-between text-sm font-bold">
                    <span>Opening Balance</span>
                    <span className={openingBalance > 0 ? 'text-orange-600' : 'text-emerald-600'}>{fmt(openingBalance, form.currency)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <button type="submit" disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition text-base">
          <Save className="w-5 h-5" /> {saving ? 'Creating Deal...' : 'Create Deal'}
        </button>
      </form>
    </div>
  );
}
