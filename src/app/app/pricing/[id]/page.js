'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, History, ChevronDown, ChevronRight, Layers, Clock, AlertCircle,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

const fmtDateTime = d => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function PricingDetailPage({ params }) {
  const { id } = use(params);
  const [plan, setPlan]       = useState(null);
  const [versions, setVersions] = useState([]);
  const [changes, setChanges]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [p, v] = await Promise.all([
        fetchWithAuth(`/api/pricing/${id}`).then(r => r.json()),
        fetchWithAuth(`/api/pricing/${id}/versions`).then(r => r.json()),
      ]);
      if (!p.success) throw new Error(p.error || 'Plan not found');
      setPlan(p.data);
      setVersions(v.versions || []);
      setChanges(v.changes || []);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading plan…</div>;
  if (error || !plan) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Link href="/app/pricing" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Pricing
        </Link>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-xl p-6 text-center">{error || 'Plan not found'}</div>
      </div>
    );
  }

  const currentVersion = plan.current_version || 1;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href="/app/pricing" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Pricing
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-foreground">{plan.name}</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 capitalize">{plan.system}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">v{currentVersion} (current)</span>
            {!plan.is_active && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">inactive</span>}
          </div>
          {plan.description && <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>}
        </div>
      </div>

      {/* Cycles */}
      <Section icon={<Clock className="w-4 h-4" />} title={`Pricing Cycles (${plan.pricing_cycles?.length || 0})`}>
        {plan.pricing_cycles?.length ? (
          <SimpleTable
            headers={['Cycle', 'Duration', 'Price', 'Status']}
            rows={plan.pricing_cycles.map(c => [
              <span key="n" className="capitalize font-medium">{c.name}</span>,
              `${c.duration_days} days`,
              `${c.currency} ${parseFloat(c.price || 0).toLocaleString()}`,
              c.is_active ? 'active' : 'inactive',
            ])}
          />
        ) : <Empty text="No cycles defined." />}
      </Section>

      {/* Plan Limits + Support */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Limits">
          <Row label="Setup fee">{plan.setup_fee ? `${plan.pricing_cycles?.[0]?.currency || 'UGX'} ${parseFloat(plan.setup_fee).toLocaleString()}` : '—'}</Row>
          <Row label="Trial days">{plan.trial_days ?? 0}</Row>
          <Row label="Grace days">{plan.grace_days ?? 0}</Row>
          <Row label="Max users">{plan.max_users ?? '—'}</Row>
          <Row label="Max students">{plan.max_students ?? '—'}</Row>
          <Row label="SMS limit">{plan.sms_limit ?? '—'}</Row>
        </Card>
        <Card title="Support & Deployment">
          <Row label="Support tier"><span className="capitalize">{plan.support_tier || '—'}</span></Row>
          <Row label="Deployment"><span className="capitalize">{plan.deployment_type || '—'}</span></Row>
          <Row label="Complexity"><span className="capitalize">{plan.implementation_complexity || '—'}</span></Row>
          <Row label="Onboarding hours">{plan.onboarding_hours ?? '—'}</Row>
        </Card>
      </div>

      {/* Features */}
      {plan.features?.length > 0 && (
        <Section icon={<Layers className="w-4 h-4" />} title="Features (current version)">
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {plan.features.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                <span className="text-emerald-500">✓</span>{f}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Version history */}
      <Section icon={<History className="w-4 h-4" />} title={`Version History (${versions.length})`}>
        {versions.length === 0 ? (
          <Empty text="No version history yet." />
        ) : (
          <div className="space-y-2">
            {versions.map(v => {
              const isOpen = !!expanded[v.id];
              return (
                <div key={v.id} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpanded(s => ({ ...s, [v.id]: !s[v.id] }))}
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span className="font-medium">v{v.version}</span>
                      {v.is_current && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">current</span>}
                      <span className="text-sm text-muted-foreground">{v.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDateTime(v.created_at)} · {v.created_by_name || 'system'}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 py-3 border-t border-border bg-muted/20 space-y-2 text-sm">
                      {v.description && <p className="text-muted-foreground">{v.description}</p>}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                        <Stat label="Setup">{v.setup_fee ?? '—'}</Stat>
                        <Stat label="Trial days">{v.trial_days ?? '—'}</Stat>
                        <Stat label="Grace days">{v.grace_days ?? '—'}</Stat>
                        <Stat label="Max users">{v.max_users ?? '—'}</Stat>
                        <Stat label="Support">{v.support_tier || '—'}</Stat>
                        <Stat label="Deployment">{v.deployment_type || '—'}</Stat>
                      </div>
                      {Array.isArray(v.cycles_snapshot) && v.cycles_snapshot.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">Cycles snapshot:</div>
                          <ul className="text-xs space-y-1">
                            {v.cycles_snapshot.map((c, i) => (
                              <li key={i} className="font-mono text-muted-foreground">
                                {c.name} · {c.duration_days}d · {c.currency} {parseFloat(c.price || 0).toLocaleString()}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(v.features) && v.features.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">Features:</div>
                          <ul className="text-xs grid grid-cols-1 md:grid-cols-2 gap-1">
                            {v.features.map((f, i) => <li key={i}>• {f}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Change log */}
      <Section icon={<AlertCircle className="w-4 h-4" />} title={`Change Log (${changes.length})`}>
        {changes.length === 0 ? (
          <Empty text="No mutations recorded." />
        ) : (
          <ul className="space-y-2">
            {changes.map(c => (
              <li key={c.id} className="flex items-start gap-3 text-sm border-b border-border pb-2 last:border-0">
                <span className="text-xs text-muted-foreground w-40 shrink-0">{fmtDateTime(c.created_at)}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  c.change_type === 'structural_update' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                  c.change_type === 'cosmetic_update'   ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
                  c.change_type === 'version_snapshot'  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  'bg-muted text-muted-foreground'
                }`}>{c.change_type}</span>
                <span className="text-muted-foreground flex-1">
                  v{c.from_version || '?'} → v{c.to_version || '?'} {c.reason ? `· ${c.reason}` : ''}
                </span>
                <span className="text-xs text-muted-foreground">{c.actor_name || ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <h2 className="font-semibold text-foreground text-sm uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
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
function Stat({ label, children }) {
  return (
    <div className="bg-background rounded p-2 border border-border">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-foreground font-medium">{children}</div>
    </div>
  );
}
function Empty({ text }) { return <div className="text-sm text-muted-foreground text-center py-4">{text}</div>; }
function SimpleTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border">
          {headers.map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2 text-foreground">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
