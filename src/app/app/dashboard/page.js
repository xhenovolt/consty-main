'use client';

/**
 * Role-Based Dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 * Widgets are only rendered when the user has the required permission.
 * The dashboard adapts to the user's role:
 *
 *   superadmin / admin  → Full system overview (all widgets)
 *   sales / pipeline    → Prospects, deals, follow-ups, pipeline
 *   finance             → Accounts, ledger, income/expenses
 *   viewer / staff      → Limited read-only overview
 *
 * Every widget declares `permission` (e.g. 'finance.view').
 * If the user lacks that permission the widget is silently omitted.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import {
  BarChart3, Users, Handshake, DollarSign, TrendingUp, Calendar,
  ArrowUpRight, ArrowDownRight, Wallet, Activity, AlertTriangle,
  Clock, Zap, ExternalLink, Shield, Target, UserCheck,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';
import { usePermissions } from '@/components/providers/PermissionProvider';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { PageTransition } from '@/components/ui/PageTransition';
import Link from 'next/link';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n, currency = 'UGX') {
  if (n === null || n === undefined) return formatCurrency(0, currency);
  const num = parseFloat(n);
  if (num >= 1000000) return `${currency} ${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${currency} ${(num / 1000).toFixed(1)}K`;
  return formatCurrency(num, currency);
}

// ─── Small Components ───────────────────────────────────────────────────────

function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  const colors = {
    blue:   'from-blue-500 to-blue-600',
    green:  'from-emerald-500 to-emerald-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    rose:   'from-rose-500 to-rose-600',
    cyan:   'from-cyan-500 to-cyan-600',
    amber:  'from-amber-500 to-amber-600',
    indigo: 'from-indigo-500 to-indigo-600',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-xl p-5 text-white shadow-lg`}>
      <div className="flex items-center justify-between mb-3">
        <Icon className="w-5 h-5 opacity-80" />
        {trend !== undefined && (
          <div className="flex items-center gap-1 text-xs">
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{title}</div>
      {subtitle && <div className="text-xs opacity-75 mt-1">{subtitle}</div>}
    </div>
  );
}

function SectionCard({ title, href, linkLabel, children }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {href && (
          <Link href={href} className="text-sm text-blue-600 hover:underline">
            {linkLabel || 'View all →'}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ message }) {
  return <p className="text-muted-foreground text-sm py-8 text-center">{message}</p>;
}

const ATTENTION_ICONS = {
  overdue_followup: { icon: Calendar,  color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', label: 'Overdue follow-up' },
  overdue_deal:     { icon: Clock,     color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20',       label: 'Overdue deal' },
  unlinked_op:      { icon: Activity,  color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/20',   label: 'Op without expense' },
};

// ─── Dashboard Page ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const { user, hasPermission, hasModuleAccess, loading: permLoading } = usePermissions();

  // Helper: only render a widget if user has the required permission
  const can = (perm) => {
    if (!user) return false;
    if (user.is_superadmin) return true;
    return hasPermission(perm) || hasModuleAccess(perm.split('.')[0]);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res  = await fetchWithAuth('/api/dashboard');
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (err) {
        console.error('Dashboard fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    if (!permLoading) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [permLoading]);

  if (loading || permLoading) {
    return (
      <div className="p-6">
        <SkeletonDashboard />
      </div>
    );
  }

  const d          = data || {};
  const wd         = d.widgetData  || {};             // widget data map from /api/dashboard
  const fin        = wd.financial_summary   || {};
  const deals      = wd.deal_summary        || {};
  const ops        = wd.operations          || {};
  const attention  = wd.attention_items     || [];

  // Derive role label for header
  const roleLabel = user?.is_superadmin
    ? 'Superadmin'
    : (user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User');

  const isAdmin = user?.is_superadmin || user?.role === 'admin';

  return (
    <PageTransition>
    <div className="space-y-6 p-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isAdmin ? 'System Dashboard' : `${roleLabel} Dashboard`}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {user?.name || user?.email} · {roleLabel}
          </p>
        </div>
        <div className="text-xs text-muted-foreground">Auto-refreshes every 30s</div>
      </div>

      {/* ── Attention Banner (visible to all) ───────────────────────────── */}
      {attention.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Needs Attention ({attention.length})
            </span>
          </div>
          <div className="space-y-2">
            {attention.slice(0, 8).map((item, i) => {
              const cfg      = ATTENTION_ICONS[item.item_type] || ATTENTION_ICONS.unlinked_op;
              const ItemIcon = cfg.icon;
              const href     = item.item_type === 'overdue_deal'    ? `/app/deals/${item.item_id}`
                             : item.item_type === 'unlinked_op'     ? '/app/operations'
                             : '/app/followups';
              return (
                <Link key={i} href={href} className={`flex items-center justify-between px-3 py-2 rounded-lg ${cfg.bg} hover:opacity-80 transition`}>
                  <div className="flex items-center gap-2">
                    <ItemIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    <span className="text-sm font-medium text-foreground">{item.label || 'Item'}</span>
                    <span className="text-xs text-muted-foreground">{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.detail && <span className="text-xs text-muted-foreground">{new Date(item.detail).toLocaleDateString()}</span>}
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Finance KPI Cards (finance.view) ───────────────────────────── */}
      {can('finance.view') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Net Position"    value={fmt(fin.net_position)}    subtitle={`${fin.total_transactions || 0} transactions`} icon={DollarSign}     color="green"  />
          <StatCard title="Total Income"    value={fmt(fin.total_income)}    subtitle={`${fin.income_transactions || 0} payments`}    icon={TrendingUp}     color="blue"   />
          <StatCard title="Total Expenses"  value={fmt(fin.total_expenses)}  subtitle={`${fin.expense_transactions || 0} expenses`}   icon={ArrowDownRight} color="rose"   />
          {can('deals.view') && (
            <StatCard title="Active Deals"  value={deals.active_deals || 0} subtitle={fmt(deals.active_value) + ' pipeline'}         icon={Handshake}      color="purple" />
          )}
        </div>
      )}

      {/* ── Deals KPI (deals.view, no finance.view) ─────────────────────── */}
      {!can('finance.view') && can('deals.view') && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard title="Active Deals"        value={deals.active_deals || 0}       subtitle={fmt(deals.active_value) + ' pipeline'}       icon={Handshake}  color="purple" />
          <StatCard title="Outstanding Balance" value={fmt(deals.outstanding_balance)} subtitle={`${deals.overdue_deals || 0} overdue`}        icon={Clock}      color="amber"  />
          <StatCard title="Completed Deals"     value={deals.completed_deals || 0}     subtitle={fmt(deals.completed_value) + ' closed'}       icon={TrendingUp} color="green"  />
        </div>
      )}

      {/* ── Operations Quick Stats (finance.view or operations.view) ─────── */}
      {(can('finance.view') || can('operations.view')) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Activity className="w-3.5 h-3.5" />Operations</div>
            <div className="text-xl font-bold text-foreground">{ops.total_ops || 0}</div>
            <div className="text-xs text-muted-foreground">{ops.month_ops || 0} this month</div>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Zap className="w-3.5 h-3.5" />Ops Spending</div>
            <div className="text-xl font-bold text-orange-600">{fmt(ops.total_spent)}</div>
            <div className="text-xs text-muted-foreground">{fmt(ops.month_spent)} this month</div>
          </div>
          {can('deals.view') && (
            <>
              <div className="bg-card rounded-xl border p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Clock className="w-3.5 h-3.5" />Outstanding</div>
                <div className="text-xl font-bold text-amber-600">{fmt(deals.outstanding_balance)}</div>
                <div className="text-xs text-muted-foreground">{deals.overdue_deals || 0} overdue deals</div>
              </div>
              <div className="bg-card rounded-xl border p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><AlertTriangle className="w-3.5 h-3.5" />Unlinked Ops</div>
                <div className={`text-xl font-bold ${parseInt(ops.unlinked_ops) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{ops.unlinked_ops || 0}</div>
                <div className="text-xs text-muted-foreground">{parseInt(ops.unlinked_ops) > 0 ? 'need linking' : 'all linked'}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Admin Overview Row (users.view + staff.view) ─────────────────── */}
      {(can('users.view') || can('staff.view')) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {can('users.view') && (
            <Link href="/app/admin/users">
              <div className="bg-card rounded-xl border p-4 hover:border-blue-300 transition cursor-pointer">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Users className="w-3.5 h-3.5" />Total Users</div>
                <div className="text-xl font-bold text-foreground">{wd.admin_overview?.total_users ?? '—'}</div>
              </div>
            </Link>
          )}
          {can('staff.view') && (
            <Link href="/app/staff">
              <div className="bg-card rounded-xl border p-4 hover:border-blue-300 transition cursor-pointer">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><UserCheck className="w-3.5 h-3.5" />Staff Members</div>
                <div className="text-xl font-bold text-foreground">{wd.admin_overview?.total_staff ?? '—'}</div>
              </div>
            </Link>
          )}
          {can('clients.view') && (
            <Link href="/app/clients">
              <div className="bg-card rounded-xl border p-4 hover:border-blue-300 transition cursor-pointer">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Target className="w-3.5 h-3.5" />Active Clients</div>
                <div className="text-xl font-bold text-foreground">{wd.admin_overview?.total_clients ?? '—'}</div>
              </div>
            </Link>
          )}
          {can('roles.manage') && (
            <Link href="/app/admin/roles">
              <div className="bg-card rounded-xl border p-4 hover:border-blue-300 transition cursor-pointer">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Shield className="w-3.5 h-3.5" />Roles</div>
                <div className="text-xl font-bold text-foreground">{wd.admin_overview?.total_roles ?? '—'}</div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* ── Middle Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Prospect Pipeline (prospects.view) */}
        {can('prospects.view') && (
          <SectionCard title="Prospect Pipeline" href="/app/prospects">
            {(wd.pipeline_summary || []).length === 0 ? (
              <EmptyState message="No active prospects yet" />
            ) : (
              <div className="space-y-3">
                {(wd.pipeline_summary || []).map((stage) => (
                  <div key={stage.stage} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-sm font-medium capitalize">{stage.stage}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{stage.count} prospects</span>
                      <span className="text-sm font-medium">{fmt(stage.total_value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* Account Balances (accounts.view or finance.view) */}
        {(can('accounts.view') || can('finance.view')) && (
          <SectionCard title="Account Balances" href="/app/finance/accounts" linkLabel="Manage →">
            {(wd.account_balances || []).length === 0 ? (
              <div className="text-center py-8">
                <Wallet className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <EmptyState message="No accounts set up" />
                <Link href="/app/finance/accounts" className="text-sm text-blue-600 hover:underline mt-1 inline-block">Add account →</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {(wd.account_balances || []).map((acct) => (
                  <div key={acct.account_id} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{acct.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{acct.type}</div>
                    </div>
                    <span className={`text-sm font-bold ${parseFloat(acct.balance) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmt(acct.balance)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}
      </div>

      {/* ── Bottom Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Upcoming Follow-ups (prospects.view) */}
        {can('prospects.view') && (
          <SectionCard title="Upcoming Follow-ups" href="/app/followups">
            {(wd.upcoming_followups || []).length === 0 ? (
              <EmptyState message="No upcoming follow-ups" />
            ) : (
              <div className="space-y-3">
                {(wd.upcoming_followups || []).slice(0, 5).map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-1">
                    <div>
                      <div className="text-sm font-medium">{f.prospect_name}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {f.type}{f.summary ? ` — ${f.summary}` : ''}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {new Date(f.scheduled_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* Recent Activity (activity_logs.view or admin) */}
        {(can('activity_logs.view') || isAdmin) && (
          <SectionCard title="Recent Activity">
            {(wd.recent_activity || []).length === 0 ? (
              <EmptyState message="No recent activity" />
            ) : (
              <div className="space-y-2">
                {(wd.recent_activity || []).slice(0, 8).map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1">
                    <div>
                      <span className="font-medium capitalize">{a.action}</span>
                      <span className="text-muted-foreground ml-1">{a.entity_type}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}
      </div>

      {/* ── Monthly Financial Trend (finance.view) ───────────────────────── */}
      {can('finance.view') && (wd.monthly_financials || []).length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold text-foreground mb-4">Monthly Financial Trend</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {(wd.monthly_financials || []).slice(0, 6).reverse().map((m, i) => {
              const income   = parseFloat(m.income   || 0);
              const expenses = parseFloat(m.expenses || 0);
              const net      = income - expenses;
              return (
                <div key={i} className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-2">{m.month || m.period}</div>
                  <div className="text-xs text-emerald-600">+{fmt(income)}</div>
                  <div className="text-xs text-red-500">-{fmt(expenses)}</div>
                  <div className={`text-sm font-bold mt-1 ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmt(net)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── No-Access fallback for very restricted users ─────────────────── */}
      {!can('finance.view') && !can('deals.view') && !can('prospects.view') && (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium mb-1">Limited Access</p>
          <p className="text-sm text-muted-foreground">
            Your role has not been granted access to dashboard modules.
            Contact your administrator to request additional permissions.
          </p>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
