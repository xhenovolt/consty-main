'use client';

/**
 * CONSTY Project Portfolio Dashboard.
 * Every card and chart is backed by a real query against the project domain
 * (projects, project_budgets, blockers, procurement_requests, resources,
 * work_items) via /api/dashboard/projects — scoped to the projects the user
 * can see. No CRM / fake metrics.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Briefcase, Activity, AlertTriangle, Clock, CheckCircle2, Wallet, ShoppingCart,
  Package, Flag, TrendingDown, ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { fetchWithAuth } from '@/lib/fetch-client';
import { PageTransition } from '@/components/ui/PageTransition';

const STATUS_COLOR = {
  draft: '#94a3b8', planning: '#3b82f6', approved: '#6366f1', active: '#10b981',
  on_hold: '#f59e0b', frozen: '#06b6d4', closing: '#a855f7', closed: '#64748b', cancelled: '#ef4444',
};
const HEALTH_COLOR = { green: '#10b981', amber: '#f59e0b', red: '#ef4444' };
const num = (v) => Number(v || 0).toLocaleString();

function Kpi({ icon: Icon, label, value, tone = 'default', href }) {
  const toneCls = {
    default: 'text-foreground', danger: 'text-red-600', warn: 'text-amber-600', good: 'text-emerald-600',
  }[tone];
  const inner = (
    <div className="bg-card border border-border rounded-xl p-4 h-full hover:border-primary/40 transition">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Icon size={14} /> {label}</div>
      <div className={`text-2xl font-bold ${toneCls}`}>{value}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth('/api/dashboard/projects')
      .then(r => r.json()).then(j => { if (j.success) setD(j.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading dashboard…</div>;
  if (!d) return <div className="p-6 text-sm text-muted-foreground">Failed to load dashboard.</div>;

  const { portfolio, health, budget, procurement, resources, blockers, work, recent } = d;

  if (portfolio.total === 0) {
    return (
      <PageTransition>
        <div className="p-6 max-w-3xl mx-auto">
          <div className="border border-dashed border-border rounded-xl py-16 text-center">
            <Briefcase className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <h1 className="text-lg font-semibold text-foreground">No projects yet</h1>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first project to populate the portfolio dashboard.</p>
            <Link href="/app/projects?new=1" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              <Briefcase size={16} /> New Project
            </Link>
          </div>
        </div>
      </PageTransition>
    );
  }

  const statusData = Object.entries(portfolio.by_status).map(([k, v]) => ({ name: k.replace('_', ' '), value: v, key: k }));
  const healthData = [
    { name: 'Green', value: health.green, key: 'green' },
    { name: 'Amber', value: health.amber, key: 'amber' },
    { name: 'Red', value: health.red, key: 'red' },
  ].filter(x => x.value > 0);

  return (
    <PageTransition>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Project Portfolio</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Live across {portfolio.total} project{portfolio.total === 1 ? '' : 's'}.</p>
          </div>
          <Link href="/app/projects" className="inline-flex items-center gap-1 text-sm text-primary">All projects <ArrowRight size={14} /></Link>
        </div>

        {/* Portfolio KPIs */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <Kpi icon={Briefcase} label="Total" value={portfolio.total} href="/app/projects" />
          <Kpi icon={Activity} label="Active" value={portfolio.active} tone="good" />
          <Kpi icon={Clock} label="Delayed" value={portfolio.delayed} tone={portfolio.delayed ? 'warn' : 'default'} />
          <Kpi icon={AlertTriangle} label="Stalled" value={portfolio.stalled} tone={portfolio.stalled ? 'danger' : 'default'} />
          <Kpi icon={Flag} label="Awaiting approval" value={portfolio.awaiting_approval} />
          <Kpi icon={CheckCircle2} label="Near closeout" value={portfolio.near_closeout} />
        </div>

        {/* Budget KPIs */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <Kpi icon={Wallet} label="Allocated" value={num(budget.allocated)} />
          <Kpi icon={Wallet} label="Actual spent" value={num(budget.actual)} />
          <Kpi icon={Wallet} label="Committed" value={num(budget.committed)} />
          <Kpi icon={Wallet} label="Forecast" value={num(budget.forecast)} />
          <Kpi icon={TrendingDown} label="Variance" value={num(budget.variance)} tone={budget.variance < 0 ? 'danger' : 'good'} />
          <Kpi icon={AlertTriangle} label="Budget alerts" value={budget.deficit_count} tone={budget.deficit_count ? 'danger' : 'default'} />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Projects by status</h3>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={statusData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {statusData.map((s) => <Cell key={s.key} fill={STATUS_COLOR[s.key] || '#64748b'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Health distribution</h3>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={healthData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {healthData.map((h) => <Cell key={h.key} fill={HEALTH_COLOR[h.key]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Operational lists */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Top blockers" icon={AlertTriangle} empty={blockers.top.length === 0} emptyText="No open blockers">
            {blockers.top.map((b, i) => (
              <li key={i} className="flex items-start gap-2 py-1.5 text-sm">
                <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${b.severity === 'critical' ? 'bg-red-500' : b.severity === 'high' ? 'bg-orange-500' : 'bg-amber-500'}`} />
                <div className="min-w-0"><span className="text-foreground">{b.blocker_type.replace(/_/g, ' ')}</span> <span className="text-muted-foreground">· {b.project}</span>
                  {b.description && <div className="text-xs text-muted-foreground truncate">{b.description}</div>}</div>
              </li>
            ))}
          </Panel>

          <Panel title="Resource shortages" icon={Package} empty={resources.top_shortages.length === 0} emptyText="No shortages">
            {resources.top_shortages.map((r, i) => (
              <li key={i} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="text-foreground flex-1 min-w-0 truncate">{r.name} <span className="text-muted-foreground">· {r.project}</span></span>
                <span className="text-amber-600 font-medium">short {Number(r.gap)} {r.unit_of_measure || ''}</span>
              </li>
            ))}
          </Panel>

          <Panel title="Upcoming milestones" icon={Flag} empty={work.upcoming_milestones.length === 0} emptyText="None upcoming">
            {work.upcoming_milestones.map((m, i) => (
              <li key={i} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="text-foreground flex-1 min-w-0 truncate">{m.name} <span className="text-muted-foreground">· {m.project}</span></span>
                <span className="text-muted-foreground">{new Date(m.planned_end).toLocaleDateString()}</span>
              </li>
            ))}
          </Panel>

          <Panel title="Procurement & work" icon={ShoppingCart} empty={false}>
            <li className="flex items-center justify-between py-1.5 text-sm"><span className="text-muted-foreground">Requests pending approval</span><span className="font-medium text-foreground">{procurement.pending_approval}</span></li>
            <li className="flex items-center justify-between py-1.5 text-sm"><span className="text-muted-foreground">Procurement overdue</span><span className={`font-medium ${procurement.overdue ? 'text-red-600' : 'text-foreground'}`}>{procurement.overdue}</span></li>
            <li className="flex items-center justify-between py-1.5 text-sm"><span className="text-muted-foreground">Overdue work items</span><span className={`font-medium ${work.overdue_items ? 'text-amber-600' : 'text-foreground'}`}>{work.overdue_items}</span></li>
            <li className="flex items-center justify-between py-1.5 text-sm"><span className="text-muted-foreground">Open blockers</span><span className="font-medium text-foreground">{blockers.open_total}</span></li>
          </Panel>
        </div>

        {/* Recent projects */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Recent projects</h3>
          <div className="divide-y divide-border">
            {recent.map((p) => (
              <Link key={p.id} href={`/app/projects/${p.id}`} className="flex items-center gap-3 py-2 hover:bg-muted/40 -mx-2 px-2 rounded">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: HEALTH_COLOR[p.health] || '#64748b' }} />
                <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                <span className="text-sm text-foreground flex-1 min-w-0 truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.status.replace('_', ' ')}</span>
                <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(Number(p.progress_pct))}%</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function Panel({ title, icon: Icon, children, empty, emptyText }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Icon size={15} /> {title}</h3>
      {empty ? <p className="text-sm text-muted-foreground py-2">{emptyText}</p> : <ul className="divide-y divide-border">{children}</ul>}
    </div>
  );
}
