'use client';

/**
 * /app/docs/issues
 * System Architecture Issue Tracker
 * 
 * Displays all recorded architectural issues with root cause, severity,
 * status, and fix summary. Superadmin only.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, CheckCircle2, Clock, AlertCircle,
  ChevronDown, ChevronRight, Shield, RefreshCw, Loader2
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { usePermissions } from '@/components/providers/PermissionProvider';

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',    Icon: AlertTriangle },
  high:     { label: 'High',     color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', Icon: AlertCircle },
  medium:   { label: 'Medium',   color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', Icon: AlertCircle },
  low:      { label: 'Low',      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', Icon: AlertCircle },
};

const STATUS_CONFIG = {
  open:     { label: 'Open',     color: 'text-red-600 dark:text-red-400',    Icon: AlertTriangle },
  fixed:    { label: 'Fixed',    color: 'text-green-600 dark:text-green-400', Icon: CheckCircle2 },
  verified: { label: 'Verified', color: 'text-blue-600 dark:text-blue-400',   Icon: CheckCircle2 },
};

export default function IssuesPage() {
  const { user } = usePermissions();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadIssues();
  }, []);

  const loadIssues = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/arch-issues');
      const json = await res.json();
      if (json.success) setIssues(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const filtered = filter === 'all' ? issues : issues.filter(i => i.status === filter);
  const counts = {
    all: issues.length,
    open: issues.filter(i => i.status === 'open').length,
    fixed: issues.filter(i => i.status === 'fixed').length,
    verified: issues.filter(i => i.status === 'verified').length,
  };

  if (user && !user.is_superadmin) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>Superadmin access required to view architecture issues.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <nav className="text-xs text-muted-foreground mb-2">
            <Link href="/app/docs" className="hover:text-foreground">Docs</Link>
            {' / '}
            <span>Architecture Issues</span>
          </nav>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            System Architecture Issues
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All identified architectural root causes, tracked and resolved.
          </p>
        </div>
        <button
          onClick={loadIssues}
          disabled={loading}
          className="flex items-center gap-2 text-sm px-3 py-2 border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'all',      label: 'Total',    color: 'text-foreground' },
          { key: 'open',     label: 'Open',     color: 'text-red-600 dark:text-red-400' },
          { key: 'fixed',    label: 'Fixed',    color: 'text-green-600 dark:text-green-400' },
          { key: 'verified', label: 'Verified', color: 'text-blue-600 dark:text-blue-400' },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`bg-card border rounded-xl p-4 text-left transition-all ${filter === key ? 'ring-2 ring-primary' : 'hover:bg-accent/50'}`}
          >
            <div className={`text-2xl font-bold ${color}`}>{counts[key]}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </button>
        ))}
      </div>

      {/* Issue list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border rounded-xl p-10 text-center text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40 text-green-500" />
          <p>No {filter !== 'all' ? filter : ''} issues found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((issue) => {
            const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.medium;
            const sta = STATUS_CONFIG[issue.status] || STATUS_CONFIG.open;
            const SevIcon = sev.Icon;
            const StaIcon = sta.Icon;
            const isOpen = expanded[issue.id];

            return (
              <div key={issue.id} className="bg-card border rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleExpand(issue.id)}
                  className="w-full px-5 py-4 flex items-start gap-4 text-left hover:bg-accent/30 transition-colors"
                >
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                    : <ChevronRight className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sev.color}`}>
                        <SevIcon className="w-3 h-3 inline mr-1" />
                        {sev.label}
                      </span>
                      <span className={`text-xs font-medium flex items-center gap-1 ${sta.color}`}>
                        <StaIcon className="w-3.5 h-3.5" />
                        {sta.label}
                      </span>
                      {issue.category && (
                        <span className="text-xs text-muted-foreground">{issue.category}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm leading-snug">{issue.title}</h3>
                    {issue.affected_modules?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {issue.affected_modules.map(m => (
                          <span key={m} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{m}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0 mt-0.5">
                    {new Date(issue.detected_at || issue.reported_at).toLocaleDateString()}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t px-5 py-4 space-y-4 bg-muted/20">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Description</div>
                      <p className="text-sm">{issue.description}</p>
                    </div>
                    {issue.root_cause && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Root Cause</div>
                        <p className="text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">{issue.root_cause}</p>
                      </div>
                    )}
                    {issue.fix_summary && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Fix Applied</div>
                        <p className="text-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">{issue.fix_summary}</p>
                      </div>
                    )}
                    {issue.related_logs && Object.keys(issue.related_logs).length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Log</div>
                        <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto">{JSON.stringify(issue.related_logs, null, 2)}</pre>
                      </div>
                    )}
                    {issue.fixed_at && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Fixed: {new Date(issue.fixed_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                        {issue.verified_by && <span className="ml-2">· Verified by: {issue.verified_by}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
