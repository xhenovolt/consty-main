'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, BookMarked, Briefcase, Bug, Building2, CheckCircle2, Clock, DollarSign, Monitor, Shield, Target, TrendingUp, Users, Zap } from 'lucide-react';
import Link from 'next/link';

function StatCard({ icon: Icon, label, value, sublabel, color, href }) {
  const content = (
    <div className="bg-card rounded-xl border p-4 hover:shadow-md transition group">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
          {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
        </div>
      </div>
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

function ActivityItem({ name, count }) {
  const friendlyName = name?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-foreground">{friendlyName}</span>
      <span className="text-sm font-medium text-muted-foreground">{count}</span>
    </div>
  );
}

export default function CommandCenterPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/founder/command-center', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center items-center h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--theme-primary, #3b82f6)' }} />
    </div>
  );

  if (!data) return <div className="p-6 text-center text-muted-foreground">Failed to load command center data.</div>;

  const netIncome = data.financial.revenue_30d - data.financial.expenses_30d;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Zap className="w-6 h-6" style={{ color: 'var(--theme-primary, #3b82f6)' }} />
          Founder Command Center
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time operational overview · Last 30 days</p>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard icon={DollarSign} label="Revenue (30d)" value={`UGX ${Math.round(data.financial.revenue_30d).toLocaleString()}`} color="#10b981" href="/app/finance" />
        <StatCard icon={TrendingUp} label="Net Income (30d)" value={`UGX ${Math.round(netIncome).toLocaleString()}`} sublabel={netIncome >= 0 ? 'Profitable' : 'Loss'} color={netIncome >= 0 ? '#10b981' : '#ef4444'} href="/app/finance" />
        <StatCard icon={Briefcase} label="Active Deals" value={data.deals.active} sublabel={`${data.deals.won_this_month} won this month`} color="#3b82f6" href="/app/deals" />
        <StatCard icon={Target} label="Pipeline Value" value={`UGX ${Math.round(data.pipeline.total_value).toLocaleString()}`} color="#8b5cf6" href="/app/pipeline" />
        <StatCard icon={Users} label="Team" value={`${data.team.active}/${data.team.total}`} sublabel={`${data.team.departments} departments`} color="#f59e0b" href="/app/staff" />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Monitor} label="Systems" value={data.systems.total} sublabel={`${data.systems.active_licenses} active licenses`} color="#6366f1" href="/app/systems" />
        <StatCard icon={Shield} label="Pending Approvals" value={data.approvals.pending} color={data.approvals.pending > 0 ? '#f59e0b' : '#10b981'} href="/app/admin/approvals" />
        <StatCard icon={Bug} label="Open Bugs" value={data.bugs.open} sublabel={data.bugs.critical > 0 ? `${data.bugs.critical} critical!` : 'No critical'} color={data.bugs.critical > 0 ? '#ef4444' : '#3b82f6'} href="/app/tech-intelligence" />
        <StatCard icon={BookMarked} label="Decisions (Month)" value={data.decisions.this_month} color="#8b5cf6" href="/app/decision-log" />
      </div>

      {/* Pipeline Breakdown + Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pipeline by Stage */}
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" style={{ color: 'var(--theme-primary, #3b82f6)' }} />
            Pipeline by Stage
          </h3>
          {data.pipeline.stages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No active prospects</p>
          ) : (
            <div className="space-y-2">
              {data.pipeline.stages.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-foreground capitalize">{s.stage?.replace(/_/g, ' ') || 'Unknown'}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (parseInt(s.count) / Math.max(...data.pipeline.stages.map(x => parseInt(x.count)))) * 100)}%`,
                          background: 'var(--theme-primary, #3b82f6)',
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-foreground w-8 text-right">{s.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: 'var(--theme-primary, #3b82f6)' }} />
            Activity (Last 24h)
          </h3>
          {data.activity.events_24h.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
          ) : (
            <div className="divide-y divide-border">
              {data.activity.events_24h.map((e, i) => (
                <ActivityItem key={i} name={e.event_name} count={e.count} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick alerts */}
      {(data.approvals.pending > 0 || data.bugs.critical > 0) && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-xl border border-yellow-200 dark:border-yellow-800 p-4">
          <h3 className="font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" /> Attention Required
          </h3>
          <div className="space-y-1 text-sm text-yellow-600 dark:text-yellow-400">
            {data.approvals.pending > 0 && (
              <p>• <Link href="/app/admin/approvals" className="underline">{data.approvals.pending} pending approval{data.approvals.pending > 1 ? 's' : ''}</Link> need your review</p>
            )}
            {data.bugs.critical > 0 && (
              <p>• <Link href="/app/tech-intelligence" className="underline">{data.bugs.critical} critical bug{data.bugs.critical > 1 ? 's' : ''}</Link> require immediate attention</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
