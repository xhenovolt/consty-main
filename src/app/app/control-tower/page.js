'use client';

import { useEffect, useState } from 'react';
import { Shield, Users, AlertTriangle, Activity, Building2, CheckCircle2, XCircle, Clock, ChevronRight, Network, Crown, BarChart3 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

/**
 * Founder Control Tower — Organizational Intelligence Dashboard
 * Org health, approvals, structural warnings, activity feed, authority distribution
 */

export default function ControlTowerPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth('/api/org/control-tower')
      .then(r => r.json())
      .then(res => { if (res.success) setData(res.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--theme-primary, #3b82f6)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-muted-foreground text-center">Failed to load Control Tower data.</div>;
  }

  const { org_health, authority_distribution, approval_pipeline, structural_warnings, recent_changes, department_health } = data;

  const StatCard = ({ icon: Icon, label, value, color, sub }) => (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );

  const severityColor = (s) => s === 'high' ? 'text-red-500 bg-red-500/10' : s === 'medium' ? 'text-amber-500 bg-amber-500/10' : 'text-blue-500 bg-blue-500/10';

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Crown size={22} className="text-amber-500" />
          Founder Control Tower
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Organizational intelligence — real-time authority, structure, and operational health
        </p>
      </div>

      {/* Organization Health Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Active Staff" value={org_health.active_staff} color="#10b981" />
        <StatCard icon={Network} label="Filled Positions" value={org_health.filled_positions} color="#3b82f6" />
        <StatCard icon={AlertTriangle} label="Vacant Roles" value={org_health.vacant_roles} color="#f59e0b" />
        <StatCard icon={XCircle} label="Suspended" value={org_health.suspended} color="#ef4444" />
        <StatCard icon={Building2} label="Departments" value={org_health.active_departments} color="#8b5cf6" />
        <StatCard icon={Shield} label="Total Nodes" value={org_health.total_nodes} color="#6b7280" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Authority Distribution */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 size={14} style={{ color: 'var(--theme-primary, #3b82f6)' }} />
            Authority Distribution
          </h2>
          <div className="space-y-3">
            {authority_distribution.map(al => {
              const maxCount = Math.max(...authority_distribution.map(a => parseInt(a.node_count) || 0), 1);
              const pct = Math.round(((parseInt(al.node_count) || 0) / maxCount) * 100);
              return (
                <div key={al.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-foreground">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: al.color_indicator }} />
                      {al.name}
                    </span>
                    <span className="text-muted-foreground">{al.node_count} nodes · rank {al.rank_value}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: al.color_indicator }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Approval Pipeline */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <CheckCircle2 size={14} style={{ color: 'var(--theme-primary, #3b82f6)' }} />
            Approval Pipeline
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-amber-500/10 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-amber-500">{approval_pipeline.pending}</p>
              <p className="text-[11px] text-muted-foreground">Pending</p>
            </div>
            <div className="bg-red-500/10 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-red-500">{approval_pipeline.escalated}</p>
              <p className="text-[11px] text-muted-foreground">Escalated (3d+)</p>
            </div>
            <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-emerald-500">{approval_pipeline.approved}</p>
              <p className="text-[11px] text-muted-foreground">Approved</p>
            </div>
            <div className="bg-gray-500/10 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-500">{approval_pipeline.rejected}</p>
              <p className="text-[11px] text-muted-foreground">Rejected</p>
            </div>
          </div>
        </div>

        {/* Department Health */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Building2 size={14} style={{ color: 'var(--theme-primary, #3b82f6)' }} />
            Department Health
          </h2>
          {department_health.length === 0 ? (
            <p className="text-xs text-muted-foreground">No departments.</p>
          ) : (
            <div className="space-y-2">
              {department_health.map(d => (
                <div key={d.id} className="flex items-center justify-between text-xs">
                  <span className="text-foreground truncate">{d.name}</span>
                  <span className="flex items-center gap-2 text-muted-foreground shrink-0">
                    <span className="text-emerald-500">{d.active_nodes}</span>
                    /
                    <span className="text-amber-500">{d.vacant_nodes}</span>
                    / {d.total_nodes}
                  </span>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">active / vacant / total nodes</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Structural Warnings */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" />
            Structural Warnings
            {structural_warnings.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-500">{structural_warnings.length}</span>
            )}
          </h2>
          {structural_warnings.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500" />
              No structural issues detected
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {structural_warnings.map((w, i) => (
                <div key={i} className={`flex items-start gap-3 px-3 py-2 rounded-lg ${severityColor(w.severity)}`}>
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{w.entity_name}</p>
                    <p className="text-[11px] opacity-80">{w.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity size={14} style={{ color: 'var(--theme-primary, #3b82f6)' }} />
            Organization Activity Feed
          </h2>
          {recent_changes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No recent changes.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recent_changes.map(c => (
                <div key={c.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold ${
                    c.change_type === 'created' ? 'bg-emerald-500' :
                    c.change_type === 'updated' ? 'bg-blue-500' :
                    c.change_type === 'deleted' || c.change_type === 'archived' ? 'bg-red-500' : 'bg-gray-500'
                  }`}>
                    {c.change_type === 'created' ? '+' : c.change_type === 'updated' ? '~' : '-'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground">{c.description || `${c.change_type} ${c.entity_type}`}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.actor_name || 'System'} · {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
