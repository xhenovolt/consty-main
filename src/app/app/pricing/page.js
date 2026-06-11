'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Tag, ToggleLeft, ToggleRight, Pencil, Trash2, ChevronDown, ChevronUp, DollarSign, Globe } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

const fmtCurrency = (amount, currency = 'UGX') =>
  `${currency} ${parseFloat(amount || 0).toLocaleString()}`;

const SYSTEM_COLORS = {
  drais:  'bg-blue-100 text-blue-700',
  lypha:  'bg-purple-100 text-purple-700',
  consty: 'bg-emerald-100 text-emerald-700',
};

function PlanCard({ plan, onEdit, onToggle, onDelete, onAddCycle, onEditCycle, onDeleteCycle }) {
  const [expanded, setExpanded] = useState(false);
  const color = SYSTEM_COLORS[plan.system] || 'bg-muted text-muted-foreground';

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition-all ${!plan.is_active ? 'opacity-60' : ''}`}>
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-foreground text-lg">{plan.name}</h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${color}`}>{plan.system}</span>
            {!plan.is_active && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300">Inactive</span>
            )}
          </div>
          {plan.description && <p className="text-sm text-muted-foreground mb-2">{plan.description}</p>}
          {plan.features?.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {plan.features.map((f, i) => (
                <li key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{f}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(plan)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit plan">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => onToggle(plan)} className="p-1.5 rounded hover:bg-muted" title="Toggle active">
            {plan.is_active
              ? <ToggleRight className="w-5 h-5 text-emerald-500" />
              : <ToggleLeft  className="w-5 h-5 text-muted-foreground" />}
          </button>
          <button onClick={() => onDelete(plan)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/20" title="Delete plan">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pricing Cycles</p>
            <button
              onClick={() => onAddCycle(plan)}
              className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded-lg font-medium dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/20"
            >
              <Plus className="w-3 h-3" /> Add Cycle
            </button>
          </div>
          {plan.pricing_cycles?.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No pricing cycles yet.</p>
          ) : (
            <div className="space-y-2">
              {plan.pricing_cycles?.map(cycle => (
                <div key={cycle.id} className={`flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 ${!cycle.is_active ? 'opacity-50' : ''}`}>
                  <div>
                    <span className="text-sm font-medium capitalize text-foreground">{cycle.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">({cycle.duration_days}d)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-foreground">{fmtCurrency(cycle.price, cycle.currency)}</span>
                    <button onClick={() => onEditCycle(plan, cycle)} className="p-1 rounded hover:bg-muted text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => onDeleteCycle(plan, cycle)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlanModal({ plan, onClose, onSaved }) {
  const isEdit = !!plan?.id;
  const [form, setForm] = useState({
    name: plan?.name || '',
    system: plan?.system || 'consty',
    description: plan?.description || '',
    features: plan?.features?.join('\n') || '',
    display_order: plan?.display_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async e => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        features: form.features.split('\n').map(f => f.trim()).filter(Boolean),
        display_order: parseInt(form.display_order) || 0,
      };
      const url = isEdit ? `/api/pricing/${plan.id}` : '/api/pricing';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetchWithAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!json.success) { setError(json.error || 'Failed to save'); return; }
      onSaved();
    } catch (err) { setError('Network error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold text-foreground">{isEdit ? 'Edit Plan' : 'New Pricing Plan'}</h2>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 dark:bg-red-900/30 dark:text-red-300">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Plan Name *</label>
            <input required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" placeholder="e.g. Basic, Pro, Enterprise" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">System *</label>
            <input required value={form.system} onChange={e => setForm(f => ({...f, system: e.target.value.toLowerCase()}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" placeholder="e.g. consty, drais, lypha" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Features (one per line)</label>
            <textarea rows={4} value={form.features} onChange={e => setForm(f => ({...f, features: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground resize-none font-mono" placeholder="Up to 5 users&#10;Core features&#10;Email support" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Display Order</label>
            <input type="number" value={form.display_order} onChange={e => setForm(f => ({...f, display_order: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Update Plan' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CycleModal({ plan, cycle, onClose, onSaved }) {
  const isEdit = !!cycle?.id;
  const [form, setForm] = useState({
    name: cycle?.name || 'monthly',
    duration_days: cycle?.duration_days || 30,
    price: cycle?.price || '',
    currency: cycle?.currency || 'UGX',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async e => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const url = isEdit
        ? `/api/pricing/${plan.id}/cycles/${cycle.id}`
        : `/api/pricing/${plan.id}/cycles`;
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, duration_days: parseInt(form.duration_days), price: parseFloat(form.price) }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || 'Failed to save'); return; }
      onSaved();
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  const PRESETS = [
    { label: 'Monthly',  name: 'monthly',  days: 30  },
    { label: 'Termly',   name: 'termly',   days: 90  },
    { label: 'Yearly',   name: 'yearly',   days: 365 },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-5 border-b">
          <h2 className="text-lg font-bold text-foreground">{isEdit ? 'Edit Cycle' : `Add Cycle — ${plan.name}`}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">System: {plan.system}</p>
        </div>
        <form onSubmit={save} className="p-5 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 dark:bg-red-900/30 dark:text-red-300">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Cycle Name *</label>
            <div className="flex gap-1 mb-2 flex-wrap">
              {PRESETS.map(p => (
                <button key={p.name} type="button"
                  onClick={() => setForm(f => ({...f, name: p.name, duration_days: p.days}))}
                  className={`text-xs px-2 py-1 rounded-md border ${form.name === p.name ? 'bg-blue-600 text-white border-blue-600' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <input required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" placeholder="monthly, termly, yearly, custom…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Duration (days) *</label>
            <input required type="number" min="1" value={form.duration_days} onChange={e => setForm(f => ({...f, duration_days: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-1">Price *</label>
              <input required type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
            </div>
            <div className="w-28">
              <label className="block text-sm font-medium text-foreground mb-1">Currency</label>
              <input value={form.currency} onChange={e => setForm(f => ({...f, currency: e.target.value.toUpperCase()}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" maxLength={10} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Add Cycle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const [plans, setPlans]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [systemFilter, setSystem]   = useState('');
  const [activeFilter, setActive]   = useState('true');
  const [showPlanModal, setPlanModal] = useState(false);
  const [editPlan, setEditPlan]     = useState(null);
  const [cycleModal, setCycleModal] = useState(null); // { plan, cycle? }
  const [error, setError]           = useState('');

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (systemFilter) params.set('system', systemFilter);
      if (activeFilter) params.set('active', activeFilter);
      params.set('limit', '100');
      const res  = await fetchWithAuth(`/api/pricing?${params}`);
      const json = await res.json();
      if (json.success) setPlans(json.data);
      else setError(json.error || 'Failed to load');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }, [systemFilter, activeFilter]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const handleToggle = async plan => {
    try {
      await fetchWithAuth(`/api/pricing/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !plan.is_active }),
      });
      fetchPlans();
    } catch { setError('Failed to toggle plan'); }
  };

  const handleDelete = async plan => {
    if (!confirm(`Delete "${plan.name}" (${plan.system})? This cannot be undone.`)) return;
    try {
      const res  = await fetchWithAuth(`/api/pricing/${plan.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) { setError(json.error); return; }
      fetchPlans();
    } catch { setError('Failed to delete'); }
  };

  const handleDeleteCycle = async (plan, cycle) => {
    if (!confirm(`Remove "${cycle.name}" cycle from ${plan.name}?`)) return;
    try {
      const res  = await fetchWithAuth(`/api/pricing/${plan.id}/cycles/${cycle.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) { setError(json.error); return; }
      fetchPlans();
    } catch { setError('Failed to delete cycle'); }
  };

  const systems = [...new Set(plans.map(p => p.system))].sort();

  const filtered = plans.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-blue-600" /> Pricing Plans
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consty is the single source of truth for all pricing across the ecosystem.
          </p>
        </div>
        <button
          onClick={() => { setEditPlan(null); setPlanModal(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium shrink-0"
        >
          <Plus className="w-4 h-4" /> New Plan
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex justify-between dark:bg-red-900/30 dark:text-red-300">
          {error}
          <button onClick={() => setError('')} className="font-bold ml-4">×</button>
        </div>
      )}

      {/* Public API hint */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <Globe className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">External systems must fetch pricing dynamically</p>
          <p className="text-xs text-blue-600 mt-0.5 font-mono">GET /api/pricing/system/&#123;system&#125;</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plans…" className="border border-border rounded-lg pl-9 pr-3 py-2 text-sm bg-background text-foreground w-52" />
        </div>
        <select value={systemFilter} onChange={e => setSystem(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground">
          <option value="">All systems</option>
          {systems.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
        <select value={activeFilter} onChange={e => setActive(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground">
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
          <option value="">All</option>
        </select>
      </div>

      {/* Plans */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No pricing plans found. <button onClick={() => { setEditPlan(null); setPlanModal(true); }} className="text-blue-600 underline">Create one</button>.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEdit={p => { setEditPlan(p); setPlanModal(true); }}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onAddCycle={p => setCycleModal({ plan: p, cycle: null })}
              onEditCycle={(p, c) => setCycleModal({ plan: p, cycle: c })}
              onDeleteCycle={handleDeleteCycle}
            />
          ))}
        </div>
      )}

      {showPlanModal && (
        <PlanModal
          plan={editPlan}
          onClose={() => { setPlanModal(false); setEditPlan(null); }}
          onSaved={() => { setPlanModal(false); setEditPlan(null); fetchPlans(); }}
        />
      )}

      {cycleModal && (
        <CycleModal
          plan={cycleModal.plan}
          cycle={cycleModal.cycle}
          onClose={() => setCycleModal(null)}
          onSaved={() => { setCycleModal(null); fetchPlans(); }}
        />
      )}
    </div>
  );
}
