'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Send, Check, Loader2, FileText } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const STATUS_STYLES = {
  draft:     'bg-muted text-muted-foreground',
  generated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  sent:      'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  accepted:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const fmt = (n) => 'UGX ' + parseFloat(n || 0).toLocaleString('en-UG', { minimumFractionDigits: 0 });

const CATEGORY_ICON = {
  attendance: '🔵', communication: '💬', analytics: '📊', academics: '📚',
  records: '🗂️', access: '📱', integration: '🔗', support: '🛟', base: '✅', general: '✅',
};

export default function ProposalDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();

  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchWithAuth(`/api/proposals/${id}`)
      .then(r => r.json())
      .then(json => { if (json.success) setProposal(json.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status) => {
    setUpdatingStatus(true);
    try {
      const res = await fetchWithAuth(`/api/proposals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
        setProposal(json.data);
        toast.success(`Status updated to ${status}`);
      } else toast.error(json.error);
    } catch { toast.error('Update failed'); }
    finally { setUpdatingStatus(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  if (!proposal) return <div className="p-6 text-muted-foreground">Proposal not found.</div>;

  const discPct = parseFloat(proposal.discount_percent || 0);
  const installFee = parseFloat(proposal.installation_fee || 0);
  const annualSub = parseFloat(proposal.annual_subscription || 0);
  const discountAmt = (installFee + annualSub) * (discPct / 100);

  return (
    <div className="p-6 max-w-4xl">
      {/* Nav */}
      <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
        <Link href="/app/proposals" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Proposals
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{proposal.prospect_name}</span>
      </div>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{proposal.prospect_name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {proposal.system_name} · <strong>{proposal.plan_name}</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Created {new Date(proposal.created_at).toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })}
              {proposal.created_by_name && ` by ${proposal.created_by_name}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[proposal.status] || STATUS_STYLES.draft}`}>
              {proposal.status}
            </span>
            <button
              onClick={() => window.open(`/api/proposals/${id}/pdf`, '_blank')}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Download PDF
            </button>
          </div>
        </div>

        {/* Status actions */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
          <span className="text-xs text-muted-foreground mr-1">Mark as:</span>
          {['sent','accepted','rejected'].filter(s => s !== proposal.status).map(s => (
            <button
              key={s}
              disabled={updatingStatus}
              onClick={() => updateStatus(s)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-border hover:bg-muted transition capitalize disabled:opacity-50"
            >
              {updatingStatus ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              {s}
            </button>
          ))}
          <Link
            href={`/app/prospects/${proposal.prospect_id}/proposal`}
            className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border px-2.5 py-1 rounded-lg hover:bg-muted transition"
          >
            <FileText className="w-3.5 h-3.5" /> New Proposal
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Plan details */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground mb-4">Plan Details</h2>
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">{proposal.plan_name}</span>
            {proposal.is_popular && <span className="bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">⭐ Popular</span>}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            {proposal.student_limit
              ? `Up to ${parseFloat(proposal.student_limit).toLocaleString()} students`
              : 'Unlimited students'}
          </p>

          {/* Features */}
          <div className="space-y-1.5">
            {(proposal.features || []).map((f, i) => (
              <div key={f.id || i} className="flex items-center gap-2 text-sm">
                <span className="text-base leading-none">{CATEGORY_ICON[f.category] || '✅'}</span>
                <span>{f.feature_name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground mb-4">Pricing</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Installation</span>
                <span className="font-semibold">{fmt(installFee)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Annual subscription</span>
                <span className="font-semibold">{fmt(annualSub)} / yr</span>
              </div>
              {discPct > 0 && (
                <>
                  <div className="flex justify-between text-sm text-emerald-600 border-t border-border pt-2">
                    <span>Discount ({discPct}%)</span>
                    <span>− {fmt(discountAmt)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm border-t-2 border-foreground pt-2">
                    <span>Net installation</span>
                    <span>{fmt(installFee - installFee * (discPct / 100))}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm">
                    <span>Net annual</span>
                    <span>{fmt(annualSub - annualSub * (discPct / 100))}</span>
                  </div>
                </>
              )}
            </div>
            {proposal.payment_terms && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                <strong>Payment terms:</strong> {proposal.payment_terms}
              </p>
            )}
          </div>

          {/* Notes */}
          {proposal.custom_notes && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground mb-3">Notes</h2>
              <p className="text-sm text-foreground">{proposal.custom_notes}</p>
            </div>
          )}

          {/* Prospect info */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground mb-3">Prospect</h2>
            <div className="space-y-1 text-sm">
              <div className="font-semibold text-foreground">{proposal.prospect_name}</div>
              {proposal.prospect_contact && <div className="text-muted-foreground">{proposal.prospect_contact}</div>}
              {proposal.prospect_email && <div className="text-muted-foreground">{proposal.prospect_email}</div>}
              {proposal.prospect_phone && <div className="text-muted-foreground">{proposal.prospect_phone}</div>}
            </div>
            <Link
              href={`/app/prospects/${proposal.prospect_id}`}
              className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              View prospect →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
