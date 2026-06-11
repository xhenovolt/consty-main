'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { Key, Search, AlertCircle, AlertTriangle, Plus, Clock, Shield, Ban, X } from 'lucide-react';

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  trial:       { label: 'Trial',       color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  active:      { label: 'Active',      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  suspended:   { label: 'Suspended',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  expired:     { label: 'Expired',     color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  revoked:     { label: 'Revoked',     color: 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
  transferred: { label: 'Transferred', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

const TYPE_CONFIG = { lifetime: 'Lifetime', annual: 'Annual', monthly: 'Monthly', trial: 'Trial' };
const INSTALL_CONFIG = { cloud: 'Cloud', onpremise: 'On-Prem', hybrid: 'Hybrid' };
const SUPPORT_CONFIG = { none: 'None', basic: 'Basic', standard: 'Standard', priority: 'Priority', enterprise: 'Enterprise' };

const TODAY = new Date().toISOString().split('T')[0];
const BLANK_FORM = {
  system_id: '', client_id: '', client_name: '', plan_id: '', deal_id: '',
  license_type: 'annual', issued_date: TODAY, expires_at: '',
  max_users: '', max_devices: '',
  installation_type: 'cloud', support_level: 'standard',
  allowed_domains: '', notes: '',
};

function HistoricalWarning({ date, onContinue, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-amber-400 shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
          <h2 className="font-semibold text-foreground text-lg">Historical Data Entry</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Issue date in the past: <strong className="text-foreground">{new Date(date).toLocaleDateString()}</strong>.
        </p>
        <div className="flex flex-col gap-2">
          <button onClick={onContinue} className="w-full bg-amber-500 text-white py-2 rounded-lg font-medium hover:bg-amber-600 transition">
            Continue — confirm date is correct
          </button>
          <button onClick={onCancel} className="w-full border border-border py-2 rounded-lg text-sm hover:bg-muted transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-foreground' }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value ?? 0}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export default function LicensesPage() {
  const [licenses, setLicenses]   = useState([]);
  const [stats, setStats]         = useState(null);
  const [systems, setSystems]     = useState([]);
  const [clients, setClients]     = useState([]);
  const [plans, setPlans]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('all');

  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(BLANK_FORM);
  const [submitting, setSubmit]   = useState(false);
  const [formError, setFormError] = useState(null);
  const [showWarning, setShowWarning] = useState(false);

  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [ld, sd, cd, pd] = await Promise.all([
        fetchWithAuth('/api/licenses?include=stats').then(r => r.json()),
        fetchWithAuth('/api/systems').then(r => r.json()).catch(() => ({})),
        fetchWithAuth('/api/clients').then(r => r.json()).catch(() => ({})),
        fetchWithAuth('/api/pricing').then(r => r.json()).catch(() => ({})),
      ]);
      setLicenses(ld.licenses || []);
      setStats(ld.stats || null);
      setSystems(sd.systems || sd.data || []);
      setClients(cd.clients || cd.data || []);
      setPlans(pd.plans || pd.data || pd.pricing_plans || []);
      setError(null);
    } catch (e) {
      setError(e.message || 'Failed to load licenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const isHistorical = (d) => d && new Date(d) < new Date(new Date().toDateString());

  const submit = async () => {
    setSubmit(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        max_users:  form.max_users ? parseInt(form.max_users, 10) : null,
        max_devices: form.max_devices ? parseInt(form.max_devices, 10) : null,
        allowed_domains: form.allowed_domains
          ? form.allowed_domains.split(',').map(s => s.trim()).filter(Boolean)
          : null,
        is_historical: isHistorical(form.issued_date),
        skip_backdated_warning: true,
      };
      const r = await fetchWithAuth('/api/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.error || 'Failed to issue license');
      toast.success(`License issued — key ${data.data.license_key}`);
      setForm(BLANK_FORM);
      setShowForm(false);
      load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSubmit(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isHistorical(form.issued_date)) { setShowWarning(true); return; }
    submit();
  };

  const filtered = licenses.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || l.client_name?.toLowerCase().includes(q)
      || l.system_name?.toLowerCase().includes(q)
      || l.license_key?.toLowerCase().includes(q)
      || l.plan_name?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return <div className="p-6 text-muted-foreground">Loading licenses…</div>;
  if (error)   return <div className="p-6 text-destructive">Error: {error}</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {showWarning && (
        <HistoricalWarning
          date={form.issued_date}
          onContinue={() => { setShowWarning(false); submit(); }}
          onCancel={() => setShowWarning(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">License Registry</h1>
            <p className="text-sm text-muted-foreground">Issuance, lifecycle, devices, renewals — full visibility.</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Issue License
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard label="Total"         value={stats.total} />
          <StatCard label="Active"        value={stats.active}        color="text-emerald-600" />
          <StatCard label="Trial"         value={stats.trial}         color="text-indigo-600" />
          <StatCard label="Suspended"     value={stats.suspended}     color="text-yellow-600" />
          <StatCard label="Expired"       value={stats.expired}       color="text-red-600" />
          <StatCard label="Revoked"       value={stats.revoked}       color="text-red-700" />
          <StatCard label="Expiring 30d"  value={stats.expiring_soon} color="text-amber-600" />
        </div>
      )}

      {/* Issue Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Issue New License</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          {formError && <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{formError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="System *">
              <select required value={form.system_id} onChange={e => setForm(f => ({ ...f, system_id: e.target.value }))} className={selectCls}>
                <option value="">— Select system —</option>
                {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Client">
              <select value={form.client_id} onChange={e => {
                const c = clients.find(x => x.id === e.target.value);
                setForm(f => ({ ...f, client_id: e.target.value, client_name: c?.company_name || f.client_name }));
              }} className={selectCls}>
                <option value="">— Select client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name || c.name}</option>)}
              </select>
            </Field>
            <Field label="Client Name *">
              <input required value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} className={inputCls} placeholder="e.g. Acme Corp" />
            </Field>
            <Field label="Pricing Plan">
              <select value={form.plan_id} onChange={e => setForm(f => ({ ...f, plan_id: e.target.value }))} className={selectCls}>
                <option value="">— None —</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="License Type">
              <select value={form.license_type} onChange={e => setForm(f => ({ ...f, license_type: e.target.value }))} className={selectCls}>
                {Object.entries(TYPE_CONFIG).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Installation Type">
              <select value={form.installation_type} onChange={e => setForm(f => ({ ...f, installation_type: e.target.value }))} className={selectCls}>
                {Object.entries(INSTALL_CONFIG).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label={<>Issue Date * {isHistorical(form.issued_date) && <span className="ml-2 text-amber-600 text-xs">⚠ Historical</span>}</>}>
              <input required type="date" value={form.issued_date} onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Expires At">
              <input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Max Users">
              <input type="number" min="0" value={form.max_users} onChange={e => setForm(f => ({ ...f, max_users: e.target.value }))} className={inputCls} placeholder="e.g. 25" />
            </Field>
            <Field label="Max Devices">
              <input type="number" min="0" value={form.max_devices} onChange={e => setForm(f => ({ ...f, max_devices: e.target.value }))} className={inputCls} placeholder="e.g. 5" />
            </Field>
            <Field label="Support Level">
              <select value={form.support_level} onChange={e => setForm(f => ({ ...f, support_level: e.target.value }))} className={selectCls}>
                {Object.entries(SUPPORT_CONFIG).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Allowed Domains (comma-separated)">
              <input value={form.allowed_domains} onChange={e => setForm(f => ({ ...f, allowed_domains: e.target.value }))} className={inputCls} placeholder="acme.com, app.acme.com" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Notes">
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputCls} placeholder="Optional internal notes" />
              </Field>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 cursor-pointer">
              {submitting ? 'Issuing…' : 'Issue License'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setFormError(null); setForm(BLANK_FORM); }}
              className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by client, system, key, plan…"
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className={selectCls}>
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Key className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground">No licenses match these filters.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <Th>Client</Th><Th>System</Th><Th>Key</Th><Th>Type</Th>
                  <Th>Status</Th><Th>Devices</Th><Th>Expires</Th><Th></Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(l => {
                  const sc = STATUS_CONFIG[l.status] || { label: l.status, color: 'bg-muted text-muted-foreground' };
                  const exp = l.expires_at ? new Date(l.expires_at) : null;
                  const expSoon = exp && exp > new Date() && exp < new Date(Date.now() + 30 * 86400000) && l.status === 'active';
                  return (
                    <tr key={l.id} className="hover:bg-muted/20 transition">
                      <td className="px-4 py-3 font-medium text-foreground">{l.client_name || '—'}</td>
                      <td className="px-4 py-3">
                        {l.system_name ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                            {l.system_name}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{l.license_key || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{TYPE_CONFIG[l.license_type] || l.license_type || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                          {sc.label}
                          {expSoon && <AlertCircle className="w-3 h-3" />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {l.device_count ?? 0}{l.max_devices ? ` / ${l.max_devices}` : ''}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {exp ? <span className={expSoon ? 'text-amber-600 font-medium' : ''}>{exp.toLocaleDateString()}</span> : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/app/licenses/${l.id}`} className="text-primary hover:underline text-xs font-medium">Manage →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            {filtered.length} license{filtered.length !== 1 ? 's' : ''}
            {(statusFilter !== 'all' || search) ? ` (filtered from ${licenses.length})` : ''}
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls  = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';
const selectCls = inputCls + ' [&>option]:bg-background';

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

function Th({ children }) {
  return <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{children}</th>;
}
