'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, ArrowRight, ChevronDown, ChevronRight, Filter, BarChart3, Users, Shield, AlertTriangle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

const STATUS_COLORS = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', fill: '#f59e0b' },
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', fill: '#10b981' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', fill: '#ef4444' },
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-UG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatRecordType(type) {
  return type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
}

export default function ApprovalPipelinePage() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [pendingRes, mineRes] = await Promise.all([
        fetchWithAuth('/api/approvals?view=pending'),
        fetchWithAuth('/api/approvals?view=mine'),
      ]);
      const pendingData = await pendingRes.json();
      const mineData = await mineRes.json();
      const all = [...(pendingData.data || []), ...(mineData.data || [])];
      // Deduplicate by id
      const seen = new Set();
      const unique = all.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
      setApprovals(unique.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch {} finally { setLoading(false); }
  };

  const pending = approvals.filter(a => a.status === 'pending');
  const approved = approvals.filter(a => a.status === 'approved');
  const rejected = approvals.filter(a => a.status === 'rejected');

  const recordTypes = [...new Set(approvals.map(a => a.target_record_type))];

  const filtered = approvals.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterType && a.target_record_type !== filterType) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-6 h-6" style={{ color: 'var(--theme-primary, #3b82f6)' }} />
          Approval Pipeline
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Visual overview of approval workflow</p>
      </div>

      {/* Pipeline Stage Summary */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2">
        {/* Pending Stage */}
        <button
          onClick={() => setFilterStatus(filterStatus === 'pending' ? '' : 'pending')}
          className={`flex-1 min-w-[180px] rounded-xl border-2 p-4 transition cursor-pointer ${filterStatus === 'pending' ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' : 'border-border bg-card hover:border-amber-300'}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <span className="font-semibold text-foreground">Pending</span>
          </div>
          <div className="text-3xl font-bold text-amber-600">{pending.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
        </button>

        <ArrowRight className="w-6 h-6 text-muted-foreground shrink-0" />

        {/* Approved Stage */}
        <button
          onClick={() => setFilterStatus(filterStatus === 'approved' ? '' : 'approved')}
          className={`flex-1 min-w-[180px] rounded-xl border-2 p-4 transition cursor-pointer ${filterStatus === 'approved' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' : 'border-border bg-card hover:border-emerald-300'}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="font-semibold text-foreground">Approved</span>
          </div>
          <div className="text-3xl font-bold text-emerald-600">{approved.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Completed successfully</p>
        </button>

        <ArrowRight className="w-6 h-6 text-muted-foreground shrink-0" />

        {/* Rejected Stage */}
        <button
          onClick={() => setFilterStatus(filterStatus === 'rejected' ? '' : 'rejected')}
          className={`flex-1 min-w-[180px] rounded-xl border-2 p-4 transition cursor-pointer ${filterStatus === 'rejected' ? 'border-red-400 bg-red-50 dark:bg-red-950/20' : 'border-border bg-card hover:border-red-300'}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="font-semibold text-foreground">Rejected</span>
          </div>
          <div className="text-3xl font-bold text-red-600">{rejected.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Denied</p>
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-2 py-1 border border-border rounded-lg text-sm bg-background text-foreground"
        >
          <option value="">All Types</option>
          {recordTypes.map(t => <option key={t} value={t}>{formatRecordType(t)}</option>)}
        </select>
        {(filterStatus || filterType) && (
          <button onClick={() => { setFilterStatus(''); setFilterType(''); }} className="text-xs text-muted-foreground hover:text-foreground underline">Clear filters</button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} requests</span>
      </div>

      {/* Request List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--theme-primary, #3b82f6)' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No approval requests found</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border divide-y divide-border">
          {filtered.map(a => {
            const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
            const isExpanded = expandedId === a.id;
            return (
              <div key={a.id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition text-left"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}

                  {/* Status indicator */}
                  <div className={`w-3 h-3 rounded-full ${sc.bg} border ${sc.border}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{a.action_requested?.replace(/_/g, ' ')}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>{a.status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatRecordType(a.target_record_type)}
                      {a.requester_name && ` · by ${a.requester_name}`}
                      <span> · {formatDate(a.created_at)}</span>
                    </div>
                  </div>

                  {a.status === 'pending' && (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-12 pb-4 space-y-2">
                    {a.reason && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Reason:</span>
                        <p className="text-sm text-foreground/80">{a.reason}</p>
                      </div>
                    )}
                    {a.approver_name && (
                      <div className="text-xs text-muted-foreground">
                        {a.status === 'approved' ? 'Approved' : 'Reviewed'} by <span className="text-foreground">{a.approver_name}</span>
                        {a.resolved_at && ` on ${formatDate(a.resolved_at)}`}
                      </div>
                    )}
                    {a.approver_notes && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Notes:</span>
                        <p className="text-sm text-foreground/80">{a.approver_notes}</p>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Record ID: <span className="font-mono text-foreground">{a.target_record_id?.slice(0, 8)}...</span>
                    </div>
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
