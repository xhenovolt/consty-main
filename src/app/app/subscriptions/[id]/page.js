'use client';

import { useEffect, useState, use } from 'react';
import {
  ArrowLeft, RefreshCw, XCircle, Calendar, DollarSign, Building2, CreditCard,
  Clock, Pause, Play, ArrowUp, ArrowDown, Activity, AlertTriangle, X,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import Link from 'next/link';

const fmtCurrency = (amount, currency = 'UGX') =>
  `${currency} ${parseFloat(amount || 0).toLocaleString()}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = d => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_COLORS = {
  pending:   'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  trial:     'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  active:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  paused:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  overdue:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  expired:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const EVENT_COLORS = {
  created: 'bg-slate-100 text-slate-700', activated: 'bg-emerald-100 text-emerald-700',
  renewed: 'bg-blue-100 text-blue-700', paused: 'bg-yellow-100 text-yellow-700',
  resumed: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-red-100 text-red-700',
  expired: 'bg-red-100 text-red-700', upgraded: 'bg-purple-100 text-purple-700',
  downgraded: 'bg-orange-100 text-orange-700', payment: 'bg-emerald-100 text-emerald-700',
  refund: 'bg-pink-100 text-pink-700',
};

const TONE = {
  red: 'bg-red-600 hover:bg-red-700', yellow: 'bg-yellow-600 hover:bg-yellow-700',
  blue: 'bg-blue-600 hover:bg-blue-700', purple: 'bg-purple-600 hover:bg-purple-700',
  emerald: 'bg-emerald-600 hover:bg-emerald-700',
};

export default function SubscriptionDetailPage({ params }) {
  const { id } = use(params);
  const [sub, setSub]         = useState(null);
  const [events, setEvents]   = useState({ events: [], status_history: [], pause_history: [], cycles: [] });
  const [plans, setPlans]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [modal, setModal]     = useState(null);
  const [input, setInput]     = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [s, e, p] = await Promise.all([
        fetchWithAuth(`/api/subscriptions/${id}`).then(r => r.json()),
        fetchWithAuth(`/api/subscriptions/${id}/events`).then(r => r.json()).catch(() => ({})),
        fetchWithAuth('/api/pricing').then(r => r.json()).catch(() => ({})),
      ]);
      if (!s.success) throw new Error(s.error || 'Not found');
      setSub(s.data);
      setEvents(e.success ? e : { events: [], status_history: [], pause_history: [], cycles: [] });
      setPlans(p.data || []);
      setError('');
    } catch (err) { setError(err.message || 'Network error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const act = async (path, body) => {
    setBusy(true);
    try {
      const r = await fetchWithAuth(`/api/subscriptions/${id}/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      }).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Action failed');
      setModal(null); setInput({});
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }
  if (error && !sub) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Link href="/app/subscriptions" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Subscriptions
        </Link>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-xl p-6 text-center">{error || 'Subscription not found'}</div>
      </div>
    );
  }

  const today    = new Date();
  const endDate  = new Date(sub.end_date);
  const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

  const canPause     = sub.status === 'active';
  const canResume    = sub.status === 'paused';
  const canCancel    = sub.status !== 'cancelled';
  const canRenew     = sub.status !== 'cancelled';
  const canChangePlan = sub.status !== 'cancelled';

  const samePlanCycles = plans.find(p => p.id === sub.plan_id)?.pricing_cycles || [];
  const allCycles = plans.flatMap(p => (p.pricing_cycles || []).map(c => ({ ...c, plan_id: p.id, plan_name: p.name })));

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/app/subscriptions" className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">{sub.client_name}</h1>
            <p className="text-sm text-muted-foreground">{sub.plan_name} · {sub.system}</p>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[sub.status] || 'bg-muted'}`}>{sub.status}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPause && (
            <button onClick={() => setModal('pause')} disabled={busy}
              className={`flex items-center gap-1.5 ${TONE.yellow} text-white px-3 py-1.5 rounded-lg text-sm cursor-pointer disabled:opacity-50`}>
              <Pause className="w-4 h-4" /> Pause
            </button>
          )}
          {canResume && (
            <button onClick={() => act('resume')} disabled={busy}
              className={`flex items-center gap-1.5 ${TONE.emerald} text-white px-3 py-1.5 rounded-lg text-sm cursor-pointer disabled:opacity-50`}>
              <Play className="w-4 h-4" /> Resume
            </button>
          )}
          {canChangePlan && (
            <>
              <button onClick={() => setModal('upgrade')} disabled={busy}
                className={`flex items-center gap-1.5 ${TONE.purple} text-white px-3 py-1.5 rounded-lg text-sm cursor-pointer disabled:opacity-50`}>
                <ArrowUp className="w-4 h-4" /> Upgrade
              </button>
              <button onClick={() => setModal('downgrade')} disabled={busy}
                className={`flex items-center gap-1.5 ${TONE.blue} text-white px-3 py-1.5 rounded-lg text-sm cursor-pointer disabled:opacity-50`}>
                <ArrowDown className="w-4 h-4" /> Downgrade
              </button>
            </>
          )}
          {canRenew && (
            <button onClick={() => act('renew')} disabled={busy}
              className={`flex items-center gap-1.5 ${TONE.emerald} text-white px-3 py-1.5 rounded-lg text-sm cursor-pointer disabled:opacity-50`}>
              <RefreshCw className="w-4 h-4" /> Renew
            </button>
          )}
          {canCancel && (
            <button onClick={() => setModal('cancel')} disabled={busy}
              className={`flex items-center gap-1.5 ${TONE.red} text-white px-3 py-1.5 rounded-lg text-sm cursor-pointer disabled:opacity-50`}>
              <XCircle className="w-4 h-4" /> Cancel
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-xl flex justify-between">
          {error}
          <button onClick={() => setError('')} className="font-bold ml-4">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card icon={<CreditCard className="w-4 h-4" />} title="Subscription">
          <Row label="Status"><span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[sub.status] || ''}`}>{sub.status}</span></Row>
          <Row label="Plan">{sub.plan_name}</Row>
          <Row label="System"><span className="capitalize">{sub.system}</span></Row>
          <Row label="Cycle"><span className="capitalize">{sub.cycle_name}</span></Row>
          <Row label="Price">{fmtCurrency(sub.price, sub.currency)} / {sub.cycle_name}</Row>
          <Row label="Auto-renew">{sub.auto_renew ? 'Yes' : 'No'}</Row>
          {sub.plan_version_id && <Row label="Plan Version"><span className="text-xs font-mono text-muted-foreground">pinned</span></Row>}
        </Card>

        <Card icon={<Calendar className="w-4 h-4" />} title="Dates">
          <Row label="Start Date">{fmtDate(sub.start_date)}</Row>
          <Row label="End Date">
            <span className={sub.status === 'active' && daysLeft >= 0 && daysLeft <= 7 ? 'text-red-600 font-semibold' : ''}>
              {fmtDate(sub.end_date)}
            </span>
          </Row>
          {sub.status === 'active' && daysLeft >= 0 && (
            <Row label="Days Left">
              <span className={daysLeft <= 7 ? 'text-red-600 font-semibold' : daysLeft <= 14 ? 'text-amber-600 font-medium' : 'text-emerald-600'}>
                {daysLeft} days
              </span>
            </Row>
          )}
          <Row label="Created">{fmtDate(sub.created_at)}</Row>
          {sub.paused_at && <Row label="Paused">{fmtDateTime(sub.paused_at)}</Row>}
          {sub.cancelled_at && <Row label="Cancelled">{fmtDateTime(sub.cancelled_at)}</Row>}
        </Card>

        <Card icon={<Building2 className="w-4 h-4" />} title="Client">
          <Row label="Company">{sub.client_name}</Row>
          {sub.contact_name && <Row label="Contact">{sub.contact_name}</Row>}
          {sub.client_email && <Row label="Email">{sub.client_email}</Row>}
        </Card>

        <Card icon={<DollarSign className="w-4 h-4" />} title="Plan Features">
          {sub.plan_description && <p className="text-sm text-muted-foreground">{sub.plan_description}</p>}
          {sub.features?.length > 0 ? (
            <ul className="space-y-1">
              {sub.features.map((f, i) => (
                <li key={i} className="text-sm text-foreground flex items-center gap-2 before:content-['✓'] before:text-emerald-500 before:font-bold before:text-xs">{f}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">No features listed.</p>
          )}
        </Card>
      </div>

      {/* Pause history */}
      {events.pause_history?.length > 0 && (
        <Section icon={<Pause className="w-4 h-4" />} title="Pause History">
          <SimpleTable
            headers={['Paused', 'Resumed', 'Reason', 'By']}
            rows={events.pause_history.map(p => [
              fmtDateTime(p.paused_at),
              p.resumed_at ? fmtDateTime(p.resumed_at) : <span className="text-amber-600">— still paused —</span>,
              p.reason || '—',
              p.paused_by_name || '—',
            ])}
          />
        </Section>
      )}

      {/* Status timeline */}
      {events.status_history?.length > 0 && (
        <Section icon={<Activity className="w-4 h-4" />} title="Status Timeline">
          <ul className="space-y-2">
            {events.status_history.map(s => (
              <li key={s.id} className="flex items-start gap-3 text-sm border-b border-border pb-2 last:border-0">
                <span className="text-xs text-muted-foreground w-40 shrink-0">{fmtDateTime(s.created_at)}</span>
                <span className="text-muted-foreground">{s.from_status || 'new'} →</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.to_status] || 'bg-muted'}`}>{s.to_status}</span>
                <span className="text-muted-foreground flex-1">{s.reason || ''}</span>
                <span className="text-xs text-muted-foreground">{s.actor_name || ''}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Per-cycle billing */}
      <Section icon={<Clock className="w-4 h-4" />} title={`Billing Cycles (${events.cycles?.length || 0})`}>
        {(!events.cycles || events.cycles.length === 0) ? (
          <Empty text="No cycles recorded yet." />
        ) : (
          <SimpleTable
            headers={['#', 'Period', 'Amount', 'Status', 'Paid']}
            rows={events.cycles.map(c => [
              `#${c.cycle_number}`,
              `${fmtDate(c.period_start)} → ${fmtDate(c.period_end)}`,
              fmtCurrency(c.amount, c.currency),
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                c.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                c.status === 'overdue' ? 'bg-red-100 text-red-700' :
                'bg-slate-100 text-slate-700'
              } dark:bg-red-900/30 dark:text-red-300 dark:bg-emerald-900/30 dark:text-emerald-300`}>{c.status}</span>,
              c.paid_at ? fmtDateTime(c.paid_at) : '—',
            ])}
          />
        )}
      </Section>

      {/* Events */}
      <Section icon={<Activity className="w-4 h-4" />} title={`Events (${events.events?.length || 0})`}>
        {(!events.events || events.events.length === 0) ? (
          <Empty text="No events recorded." />
        ) : (
          <ul className="space-y-2">
            {events.events.map(e => (
              <li key={e.id} className="flex items-start gap-3 text-sm border-b border-border pb-2 last:border-0">
                <span className="text-xs text-muted-foreground w-40 shrink-0">{fmtDateTime(e.created_at)}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EVENT_COLORS[e.event_type] || 'bg-muted'}`}>{e.event_type}</span>
                <span className="text-muted-foreground flex-1">{e.description || '—'}</span>
                <span className="text-xs text-muted-foreground">{e.actor_name || ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Modals */}
      {modal === 'pause' && (
        <Modal title="Pause Subscription" onClose={() => setModal(null)}
          onConfirm={() => act('pause', { reason: input.reason })}
          confirmLabel="Pause" tone="yellow" busy={busy}>
          <Textarea label="Reason *" value={input.reason || ''} onChange={v => setInput(s => ({ ...s, reason: v }))} />
        </Modal>
      )}
      {modal === 'cancel' && (
        <Modal title="Cancel Subscription" onClose={() => setModal(null)}
          onConfirm={() => act('cancel', { notes: input.notes })}
          confirmLabel="Cancel Subscription" tone="red" busy={busy}
          warning="This action cannot be undone. Auto-renew will be disabled and the subscription will not bill again.">
          <Textarea label="Cancellation notes" value={input.notes || ''} onChange={v => setInput(s => ({ ...s, notes: v }))} />
        </Modal>
      )}
      {(modal === 'upgrade' || modal === 'downgrade') && (
        <Modal title={modal === 'upgrade' ? 'Upgrade Plan' : 'Downgrade Plan'} onClose={() => setModal(null)}
          onConfirm={() => act(modal, {
            new_plan_id: input.new_plan_id,
            new_pricing_cycle_id: input.new_cycle_id,
            reason: input.reason,
          })}
          confirmLabel={modal === 'upgrade' ? 'Upgrade' : 'Downgrade'}
          tone={modal === 'upgrade' ? 'purple' : 'blue'} busy={busy}>
          <SelectField label="New Plan *" value={input.new_plan_id || ''}
            onChange={v => setInput(s => ({ ...s, new_plan_id: v, new_cycle_id: '' }))}
            options={[{ value: '', label: '— Select —' }, ...plans.map(p => ({ value: p.id, label: `${p.name} (${p.system})` }))]}
          />
          <SelectField label="New Cycle *" value={input.new_cycle_id || ''}
            onChange={v => setInput(s => ({ ...s, new_cycle_id: v }))}
            options={[
              { value: '', label: '— Select —' },
              ...((plans.find(p => p.id === input.new_plan_id)?.pricing_cycles || []).map(c => ({
                value: c.id, label: `${c.name} — ${fmtCurrency(c.price, c.currency)}`,
              }))),
            ]}
          />
          <Textarea label="Reason" value={input.reason || ''} onChange={v => setInput(s => ({ ...s, reason: v }))} />
        </Modal>
      )}
    </div>
  );
}

function Card({ icon, title, children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
        {icon} {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground flex items-center gap-2 mb-3">{icon} {title}</h2>
      {children}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground text-right">{children}</span>
    </div>
  );
}

function Empty({ text }) {
  return <div className="text-sm text-muted-foreground text-center py-4">{text}</div>;
}

function SimpleTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {headers.map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2 text-foreground">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

function Textarea({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className={inputCls} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={`${inputCls} [&>option]:bg-background`}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Modal({ title, children, onClose, onConfirm, confirmLabel, tone = 'blue', busy, warning }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full p-6 space-y-4">
        <h3 className="font-semibold text-foreground text-lg">{title}</h3>
        {warning && (
          <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {warning}
          </div>
        )}
        <div className="space-y-3">{children}</div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition cursor-pointer">Cancel</button>
          <button onClick={onConfirm} disabled={busy}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${TONE[tone]} disabled:opacity-50 cursor-pointer`}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
