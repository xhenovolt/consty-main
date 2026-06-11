'use client';

import { useEffect, useState } from 'react';
import { Bug, Shield, CheckCircle2, AlertTriangle, BarChart3, Clock, FileCode, Wrench, Search } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

const CATEGORY_LABELS = {
  code_bug: 'Code Bug', design_flaw: 'Design Flaw', missing_validation: 'Missing Validation',
  integration: 'Integration', performance: 'Performance', security: 'Security',
  configuration: 'Configuration', data_issue: 'Data Issue', third_party: 'Third Party',
  infrastructure: 'Infrastructure', unknown: 'Unknown',
};

const CATEGORY_COLORS = {
  code_bug: '#ef4444', design_flaw: '#f59e0b', missing_validation: '#8b5cf6',
  integration: '#3b82f6', performance: '#10b981', security: '#dc2626',
  configuration: '#6366f1', data_issue: '#f97316', third_party: '#64748b',
  infrastructure: '#0ea5e9', unknown: '#94a3b8',
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-UG', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function IssueIntelligencePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth('/api/issue-intelligence')
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

  if (!data) return <div className="p-6 text-center text-muted-foreground">Failed to load issue intelligence.</div>;

  const m = data.metrics || {};

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bug className="w-6 h-6" style={{ color: 'var(--theme-primary, #3b82f6)' }} />
          Issue Intelligence
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Root cause analysis & resolution tracking</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <div className="text-xs text-muted-foreground mb-1">Open Bugs</div>
          <div className="text-2xl font-bold text-foreground">{m.open_bugs || 0}</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="text-xs text-muted-foreground mb-1">Critical</div>
          <div className="text-2xl font-bold" style={{ color: parseInt(m.critical_bugs) > 0 ? '#ef4444' : 'inherit' }}>{m.critical_bugs || 0}</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="text-xs text-muted-foreground mb-1">Root Causes Found</div>
          <div className="text-2xl font-bold text-foreground">{m.total_root_causes || 0}</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="text-xs text-muted-foreground mb-1">Resolutions</div>
          <div className="text-2xl font-bold text-foreground">{m.total_resolutions || 0}</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg Resolve Time</div>
          <div className="text-2xl font-bold text-foreground">{m.avg_resolve_hours ? `${parseFloat(m.avg_resolve_hours).toFixed(1)}h` : '—'}</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="text-xs text-muted-foreground mb-1">Verified Fixes</div>
          <div className="text-2xl font-bold text-emerald-600">{m.verified_fixes || 0}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Root Cause Categories */}
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Search className="w-4 h-4" style={{ color: 'var(--theme-primary, #3b82f6)' }} />
            Root Cause Distribution
          </h3>
          {(data.top_root_cause_categories || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No root causes analyzed yet</p>
          ) : (
            <div className="space-y-3">
              {data.top_root_cause_categories.map((c, i) => {
                const maxCount = Math.max(...data.top_root_cause_categories.map(x => parseInt(x.count)));
                const pct = (parseInt(c.count) / maxCount) * 100;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-foreground">{CATEGORY_LABELS[c.category] || c.category}</span>
                      <span className="text-sm font-medium text-foreground">{c.count}</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CATEGORY_COLORS[c.category] || '#94a3b8' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Resolutions */}
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Wrench className="w-4 h-4" style={{ color: 'var(--theme-primary, #3b82f6)' }} />
            Recent Resolutions
          </h3>
          {(data.recent_resolutions || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No resolutions recorded yet</p>
          ) : (
            <div className="divide-y divide-border">
              {data.recent_resolutions.map((r, i) => (
                <div key={i} className="py-2.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-foreground line-clamp-1">{r.bug_title}</span>
                    {r.is_verified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${r.severity === 'critical' ? 'bg-red-100 text-red-700' : r.severity === 'high' ? 'bg-yellow-100 text-yellow-700' : 'bg-muted text-muted-foreground'} dark:bg-red-900/30 dark:text-red-300 dark:bg-yellow-900/30 dark:text-yellow-300`}>{r.severity}</span>
                    <span>{r.resolution_type?.replace(/_/g, ' ')}</span>
                    {r.resolved_by_name && <span>by {r.resolved_by_name}</span>}
                    {r.time_to_resolve_hours && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{parseFloat(r.time_to_resolve_hours).toFixed(1)}h</span>}
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
