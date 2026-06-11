'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Users, Briefcase } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';

function StatCard({ label, value, icon: Icon, color = 'blue' }) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Icon className="w-3.5 h-3.5" />{label}</div>
      <div className={`text-xl font-bold text-${color}-600`}>{value}</div>
    </div>
  );
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchReport(); }, [reportType]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/reports?type=${reportType}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };


  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Financial and business intelligence</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'overview', label: 'Overview', icon: BarChart3 },
          { key: 'revenue', label: 'Revenue', icon: TrendingUp },
          { key: 'expenses', label: 'Expenses', icon: TrendingDown },
          { key: 'deals', label: 'Deals', icon: Briefcase },
        ].map(tab => (
          <button key={tab.key} onClick={() => setReportType(tab.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${reportType === tab.key ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : !data ? (
        <div className="text-center py-16 text-muted-foreground">No data available</div>
      ) : reportType === 'overview' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Balance" value={formatCurrency(data.total_balance)} icon={DollarSign} color="blue" />
            <StatCard label="Total Income" value={formatCurrency(data.total_income)} icon={TrendingUp} color="emerald" />
            <StatCard label="Total Expenses" value={formatCurrency(data.total_expenses)} icon={TrendingDown} color="red" />
            <StatCard label="Net Position" value={formatCurrency((data.total_income || 0) - Math.abs(data.total_expenses || 0))} icon={BarChart3} color="purple" />
          </div>
          {data.accounts?.length > 0 && (
            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-semibold mb-3">Account Balances</h3>
              <div className="divide-y">
                {data.accounts.map(a => (
                  <div key={a.id} className="flex justify-between py-2 text-sm">
                    <span className="text-foreground">{a.name} <span className="text-muted-foreground capitalize">({a.type})</span></span>
                    <span className={`font-medium ${parseFloat(a.balance) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(a.balance)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : reportType === 'revenue' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Total Revenue" value={formatCurrency(data.total_revenue)} icon={TrendingUp} color="emerald" />
            <StatCard label="Total Payments" value={data.payment_count?.toString() || '0'} icon={DollarSign} color="blue" />
            <StatCard label="Avg Payment" value={formatCurrency(data.avg_payment)} icon={BarChart3} color="purple" />
          </div>
          {data.by_method?.length > 0 && (
            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-semibold mb-3">Revenue by Payment Method</h3>
              <div className="divide-y">
                {data.by_method.map((m, i) => (
                  <div key={i} className="flex justify-between py-2 text-sm">
                    <span className="text-foreground capitalize">{m.method?.replace(/_/g, ' ') || 'Unknown'}</span>
                    <span className="font-medium text-emerald-600">{formatCurrency(m.total)} <span className="text-muted-foreground">({m.count})</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : reportType === 'expenses' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Total Expenses" value={formatCurrency(data.total_expenses)} icon={TrendingDown} color="red" />
            <StatCard label="Expense Count" value={data.expense_count?.toString() || '0'} icon={BarChart3} color="blue" />
            <StatCard label="Avg Expense" value={formatCurrency(data.avg_expense)} icon={DollarSign} color="orange" />
          </div>
          {data.by_category?.length > 0 && (
            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-semibold mb-3">Expenses by Category</h3>
              <div className="space-y-3">
                {data.by_category.map((c, i) => {
                  const total = parseFloat(data.total_expenses || 1);
                  const catTotal = parseFloat(c.total || 0);
                  const pct = total > 0 ? Math.round((catTotal / total) * 100) : 0;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize text-foreground">{c.category?.replace(/_/g, ' ') || 'Uncategorized'}</span>
                        <span className="font-medium text-red-600">{formatCurrency(c.total)} <span className="text-muted-foreground">({pct}%)</span></span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : reportType === 'deals' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Total Deals" value={data.total_deals?.toString() || '0'} icon={Briefcase} color="blue" />
            <StatCard label="Total Value" value={formatCurrency(data.total_value)} icon={DollarSign} color="purple" />
            <StatCard label="Total Collected" value={formatCurrency(data.total_collected)} icon={TrendingUp} color="emerald" />
            <StatCard label="Collection Rate" value={`${data.collection_rate || 0}%`} icon={BarChart3} color="cyan" />
          </div>
          {data.by_status?.length > 0 && (
            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-semibold mb-3">Deals by Status</h3>
              <div className="divide-y">
                {data.by_status.map((s, i) => (
                  <div key={i} className="flex justify-between py-2 text-sm">
                    <span className="text-foreground capitalize">{s.status?.replace(/_/g, ' ')}</span>
                    <span className="font-medium">{s.count} deals &middot; <span className="text-blue-600">{formatCurrency(s.total_value)}</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
