'use client';

/**
 * Approval Management Page
 * View and manage pending approval requests from the hierarchy workflow
 */

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, ChevronDown, AlertTriangle, Shield, User, FileText } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-400/10', icon: Clock },
  approved: { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-400/10', icon: XCircle },
};

export default function ApprovalsPage() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [processing, setProcessing] = useState(null);
  const [rejectNotes, setRejectNotes] = useState({});
  const [showRejectInput, setShowRejectInput] = useState(null);
  const toast = useToast();

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    try {
      const [pendingRes, mineRes] = await Promise.all([
        fetchWithAuth('/api/approvals?view=pending'),
        fetchWithAuth('/api/approvals?view=mine'),
      ]);
      const pendingData = await pendingRes.json();
      const mineData = await mineRes.json();
      if (pendingData.success) setPendingRequests(pendingData.data);
      if (mineData.success) setMyRequests(mineData.data);
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (id, status) => {
    setProcessing(id);
    try {
      const body = { status };
      if (status === 'rejected' && rejectNotes[id]) {
        body.notes = rejectNotes[id];
      }
      const res = await fetchWithAuth(`/api/approvals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(status === 'approved' ? 'Request approved' : 'Request rejected');
        setShowRejectInput(null);
        setRejectNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
        fetchApprovals();
      }
    } catch (err) {
      console.error('Failed to process approval:', err);
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--theme-primary, #3b82f6)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const tabs = [
    { key: 'pending', label: 'Pending Review', count: pendingRequests.length },
    { key: 'mine', label: 'My Requests', count: myRequests.length },
  ];

  const activeList = activeTab === 'pending' ? pendingRequests : myRequests;

  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Approval Workflow</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and manage requests that require hierarchical approval
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.10] w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-background dark:bg-white/[0.08] text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 text-[10px] rounded-md font-semibold ${
                tab.key === 'pending' && tab.count > 0
                  ? 'bg-amber-400/20 text-amber-400'
                  : 'bg-muted dark:bg-white/[0.06] text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Request List */}
      {activeList.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] text-center">
          <Shield size={48} className="text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-sm">
            {activeTab === 'pending' ? 'No pending approvals' : 'No requests submitted'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeList.map((req) => {
            const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            return (
              <div
                key={req.id}
                className="bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.10] rounded-xl p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${statusConfig.color} ${statusConfig.bg}`}>
                        <StatusIcon size={12} />
                        {statusConfig.label}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize px-2 py-0.5 bg-muted dark:bg-white/[0.06] rounded-md">
                        {req.action_requested?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-foreground mb-1">
                      {req.target_record_type?.replace(/_/g, ' ')} #{req.target_record_id}
                    </h3>
                    {req.reason && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1.5">
                        <FileText size={12} className="shrink-0 mt-0.5" />
                        {req.reason}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      {req.requester_name && (
                        <span className="flex items-center gap-1">
                          <User size={11} />
                          {req.requester_name}
                        </span>
                      )}
                      <span>{formatDate(req.created_at)}</span>
                      {req.approver_name && (
                        <span className="text-emerald-400">
                          Resolved by {req.approver_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions (only for pending tab) */}
                  {activeTab === 'pending' && req.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApproval(req.id, 'approved')}
                        disabled={processing === req.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle size={13} />
                        Approve
                      </button>
                      {showRejectInput === req.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={rejectNotes[req.id] || ''}
                            onChange={(e) => setRejectNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                            placeholder="Reason (optional)"
                            className="px-2 py-1.5 bg-muted dark:bg-white/[0.06] border border-border dark:border-white/[0.10] rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none w-40"
                          />
                          <button
                            onClick={() => handleApproval(req.id, 'rejected')}
                            disabled={processing === req.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowRejectInput(req.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-colors"
                        >
                          <XCircle size={13} />
                          Reject
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
