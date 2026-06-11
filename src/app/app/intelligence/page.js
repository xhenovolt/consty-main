'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, Bug, Zap, DollarSign, Briefcase, FileText, Activity, Building2, Code2, Shield } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

const ROLE_TABS = [
  { id: 'founder', label: 'Founder', icon: Shield, color: 'text-purple-600' },
  { id: 'coo', label: 'COO', icon: Briefcase, color: 'text-blue-600' },
  { id: 'cfo', label: 'CFO', icon: DollarSign, color: 'text-emerald-600' },
  { id: 'cto', label: 'CTO', icon: Code2, color: 'text-orange-600' },
];

export default function IntelligenceDashboardPage() {
  const [role, setRole] = useState('founder');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchWithAuth(`/api/intelligence/dashboard?role=${role}`)
      .then(r => r.json ? r.json() : r)
      .then(json => { if (json.success) setData(json.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [role]);

  const formatMoney = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v || 0);

  const MetricCard = ({ icon: Icon, label, value, subValue, color = 'text-blue-600' }) => (
    <div className="bg-card rounded-xl border p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className={`w-4 h-4 ${color}`} /> {label}</div>
      <div className="text-2xl font-bold text-foreground mt-1">{value}</div>
      {subValue && <div className="text-xs text-muted-foreground mt-0.5">{subValue}</div>}
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Intelligence Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Role-based operational intelligence overview</p>
      </div>

      {/* Role Selector */}
      <div className="flex gap-2 flex-wrap">
        {ROLE_TABS.map(t => (
          <button key={t.id} onClick={() => setRole(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${role === t.id ? 'bg-blue-600 text-white' : 'bg-card border text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : !data ? (
        <div className="bg-card rounded-xl border p-8 text-center text-muted-foreground">No data available</div>
      ) : (
        <div className="space-y-6">
          {/* Founder / Universal Cards */}
          {(role === 'founder') && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard icon={DollarSign} label="Total Revenue" value={formatMoney(data.revenue?.total)} subValue={`This month: ${formatMoney(data.revenue?.this_month)}`} color="text-emerald-600" />
                <MetricCard icon={TrendingUp} label="Active Deals" value={data.deals?.active || 0} subValue={`Pipeline: ${formatMoney(data.deals?.pipeline_value)}`} color="text-blue-600" />
                <MetricCard icon={Users} label="Employees" value={data.employees?.total || 0} subValue={`Payroll: ${formatMoney(data.employees?.total_payroll)}`} color="text-purple-600" />
                <MetricCard icon={Bug} label="Open Bugs" value={data.bugs?.open || 0} subValue={`Critical: ${data.bugs?.critical || 0}`} color="text-red-600" />
              </div>

              {/* Allocation Summary */}
              {data.allocations && data.allocations.length > 0 && (
                <div className="bg-card rounded-xl border p-5">
                  <h3 className="font-semibold text-foreground mb-3">Capital Allocation</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {data.allocations.map(a => (
                      <div key={a.category} className="text-center p-3 bg-muted/30 rounded-lg">
                        <div className="text-xs text-muted-foreground capitalize">{a.category.replace(/_/g, ' ')}</div>
                        <div className="text-lg font-bold mt-1">{formatMoney(a.total)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feature & Operations Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card rounded-xl border p-5">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-orange-600" /> Feature Requests</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-2 bg-muted/30 rounded"><div className="text-xs text-muted-foreground">Proposed</div><div className="font-bold">{data.features?.proposed || 0}</div></div>
                    <div className="text-center p-2 bg-muted/30 rounded"><div className="text-xs text-muted-foreground">In Progress</div><div className="font-bold">{data.features?.in_progress || 0}</div></div>
                    <div className="text-center p-2 bg-muted/30 rounded"><div className="text-xs text-muted-foreground">Completed</div><div className="font-bold">{data.features?.completed || 0}</div></div>
                    <div className="text-center p-2 bg-muted/30 rounded"><div className="text-xs text-muted-foreground">Total</div><div className="font-bold">{data.features?.total || 0}</div></div>
                  </div>
                </div>
                <div className="bg-card rounded-xl border p-5">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-600" /> Recent Activity</h3>
                  {data.recent_activity && data.recent_activity.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {data.recent_activity.map((a, i) => (
                        <div key={i} className="text-sm flex items-center justify-between">
                          <span className="text-muted-foreground truncate">{a.description || a.event_type}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{new Date(a.created_at).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No recent activity</p>}
                </div>
              </div>
            </>
          )}

          {/* COO View */}
          {role === 'coo' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard icon={Users} label="Total Employees" value={data.employees?.total || 0} color="text-blue-600" />
                <MetricCard icon={DollarSign} label="Monthly Payroll" value={formatMoney(data.employees?.total_payroll)} color="text-emerald-600" />
                <MetricCard icon={Building2} label="Departments" value={data.operations?.departments || 0} color="text-purple-600" />
                <MetricCard icon={TrendingUp} label="Active Deals" value={data.deals?.active || 0} subValue={`Won: ${data.deals?.won || 0}`} color="text-orange-600" />
              </div>
              <div className="bg-card rounded-xl border p-5">
                <h3 className="font-semibold mb-3">Operations Overview</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Active Systems</div><div className="font-bold text-lg">{data.operations?.active_systems || 0}</div></div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Knowledge Articles</div><div className="font-bold text-lg">{data.operations?.knowledge_articles || 0}</div></div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Total Deals</div><div className="font-bold text-lg">{data.deals?.total || 0}</div></div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Pipeline Value</div><div className="font-bold text-lg">{formatMoney(data.deals?.pipeline_value)}</div></div>
                </div>
              </div>
            </>
          )}

          {/* CFO View */}
          {role === 'cfo' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard icon={DollarSign} label="Total Revenue" value={formatMoney(data.budgets?.total_revenue)} color="text-emerald-600" />
                <MetricCard icon={TrendingUp} label="This Month Revenue" value={formatMoney(data.budgets?.revenue_this_month)} color="text-blue-600" />
                <MetricCard icon={FileText} label="Total Invoices" value={data.invoices?.total || 0} subValue={`Amount: ${formatMoney(data.invoices?.total_amount)}`} color="text-purple-600" />
                <MetricCard icon={DollarSign} label="Pending Invoices" value={data.invoices?.pending || 0} color="text-orange-600" />
              </div>

              {data.expenses && data.expenses.length > 0 && (
                <div className="bg-card rounded-xl border p-5">
                  <h3 className="font-semibold mb-3">Expense Breakdown</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {data.expenses.map(exp => (
                      <div key={exp.category} className="text-center p-3 bg-muted/30 rounded-lg">
                        <div className="text-xs text-muted-foreground capitalize">{exp.category.replace(/_/g, ' ')}</div>
                        <div className="font-bold text-lg">{formatMoney(exp.total)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* CTO View */}
          {role === 'cto' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard icon={Code2} label="Systems" value={data.systems?.total || 0} subValue={`Active: ${data.systems?.active || 0}`} color="text-orange-600" />
                <MetricCard icon={Bug} label="Open Bugs" value={data.bugs?.open || 0} subValue={`Critical: ${data.bugs?.critical || 0}`} color="text-red-600" />
                <MetricCard icon={Zap} label="Feature Requests" value={data.features?.total || 0} subValue={`In Progress: ${data.features?.in_progress || 0}`} color="text-blue-600" />
                <MetricCard icon={Activity} label="Dev Activity (7d)" value={data.dev_activity?.last_7_days || 0} color="text-emerald-600" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card rounded-xl border p-5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Bug className="w-4 h-4 text-red-600" /> Bug Status</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 bg-red-50 dark:bg-red-900/10 rounded"><div className="text-xs text-red-600">Open</div><div className="font-bold text-red-700">{data.bugs?.open || 0}</div></div>
                    <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/10 rounded"><div className="text-xs text-purple-600">In Progress</div><div className="font-bold text-purple-700">{data.bugs?.in_progress || 0}</div></div>
                    <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-900/10 rounded"><div className="text-xs text-emerald-600">Resolved</div><div className="font-bold text-emerald-700">{data.bugs?.resolved || 0}</div></div>
                  </div>
                </div>
                <div className="bg-card rounded-xl border p-5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-blue-600" /> Feature Pipeline</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/10 rounded"><div className="text-xs text-blue-600">Proposed</div><div className="font-bold text-blue-700">{data.features?.proposed || 0}</div></div>
                    <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/10 rounded"><div className="text-xs text-purple-600">In Progress</div><div className="font-bold text-purple-700">{data.features?.in_progress || 0}</div></div>
                    <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-900/10 rounded"><div className="text-xs text-emerald-600">Completed</div><div className="font-bold text-emerald-700">{data.features?.completed || 0}</div></div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
