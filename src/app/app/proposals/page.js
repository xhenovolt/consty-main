'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, ExternalLink, Clock, CheckCircle, Send, XCircle, Loader2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

const STATUS_STYLES = {
  draft:     'bg-muted text-muted-foreground',
  generated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  sent:      'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  accepted:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};
const STATUS_ICONS = {
  draft: Clock,
  generated: FileText,
  sent: Send,
  accepted: CheckCircle,
  rejected: XCircle,
};

const fmt = (n) => 'UGX ' + parseFloat(n || 0).toLocaleString('en-UG', { minimumFractionDigits: 0 });

export default function ProposalsPage() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth('/api/proposals')
      .then(r => r.json())
      .then(json => { if (json.success) setProposals(json.data || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Proposals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">DRAIS sales proposals generated from prospects</p>
        </div>
      </div>

      {proposals.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">No proposals yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Go to a prospect and click <strong>Generate Proposal</strong>.
          </p>
          <Link
            href="/app/prospects"
            className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" /> Go to Prospects
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map(p => {
            const StatusIcon = STATUS_ICONS[p.status] || FileText;
            return (
              <div
                key={p.id}
                className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4 hover:border-blue-300 dark:hover:border-blue-700 transition"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-foreground truncate">{p.prospect_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.system_name} · {p.plan_name}
                      {p.installation_fee && (
                        <span className="ml-2">{fmt(p.installation_fee)} install · {fmt(p.annual_subscription)}/yr</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[p.status] || STATUS_STYLES.draft}`}>
                    <StatusIcon className="w-3 h-3" />
                    {p.status}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {new Date(p.created_at).toLocaleDateString('en-UG')}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => window.open(`/api/proposals/${p.id}/pdf`, '_blank')}
                      title="Download PDF"
                      className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/app/proposals/${p.id}`}
                      className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground hover:text-foreground"
                      title="View proposal"
                    >
                      <FileText className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
