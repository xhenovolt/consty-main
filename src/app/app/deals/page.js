'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, ChevronRight, DollarSign, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import Link from 'next/link';
import NewDealModal from '@/components/modals/NewDealModal';
import { SkeletonDeals } from '@/components/ui/Skeleton';
import { PageTransition } from '@/components/ui/PageTransition';

const STATUS_COLORS = {
  draft: 'bg-muted text-foreground', sent: 'bg-blue-100 text-blue-700', accepted: 'bg-cyan-100 text-cyan-700',
  in_progress: 'bg-purple-100 text-purple-700', completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700', disputed: 'bg-orange-100 text-orange-700',
};

export default function DealsPage() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showNewDeal, setShowNewDeal] = useState(false);

  useEffect(() => { fetchDeals(); }, [statusFilter]);

  const fetchDeals = async () => {
    try {
      let url = '/api/deals';
      if (statusFilter) url += `?status=${statusFilter}`;
      const res = await fetchWithAuth(url);
      const json = await res.json();
      if (json.success) setDeals(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  // Group totals by currency
  const byCurrency = {};
  deals.forEach(d => {
    const cur = d.currency || 'UGX';
    if (!byCurrency[cur]) byCurrency[cur] = { total: 0, paid: 0 };
    byCurrency[cur].total += parseFloat(d.total_amount || 0);
    byCurrency[cur].paid += parseFloat(d.paid_amount || 0);
  });
  const summaryParts = Object.entries(byCurrency).map(([cur, v]) =>
    `${cur} ${Math.round(v.total).toLocaleString()} (${Math.round(v.paid).toLocaleString()} paid)`
  );

  return (
    <PageTransition>
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deals</h1>
          <p className="text-sm text-muted-foreground mt-1">{deals.length} deals · {summaryParts.join(' · ')}</p>
        </div>
        <button onClick={() => setShowNewDeal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Deal
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { setStatusFilter(''); setLoading(true); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!statusFilter ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>All</button>
        {['draft','sent','accepted','in_progress','completed','cancelled'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setLoading(true); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>{s.replace(/_/g,' ')}</button>
        ))}
      </div>

      {loading ? (
        <SkeletonDeals count={5} />
      ) : deals.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No deals found</div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {deals.map(d => {
            const paid = parseFloat(d.paid_amount || 0);
            const total = parseFloat(d.total_amount || 0);
            const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
            return (
              <Link key={d.id} href={`/app/deals/${d.id}`} className="flex items-center justify-between p-4 hover:bg-muted transition">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{d.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[d.status] || 'bg-muted text-muted-foreground'}`}>{d.status?.replace(/_/g,' ')}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span>{d.client_label}</span>
                    {d.system_name && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded dark:bg-blue-900/30 dark:text-blue-300">{d.system_name}</span>}
                    {d.offering_name && <span>{d.offering_name}</span>}
                    {d.payment_count > 0 && <span>{d.payment_count} payments</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-bold text-foreground">{d.currency} {total.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{pct}% paid</div>
                  </div>
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-muted'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <NewDealModal isOpen={showNewDeal} onClose={() => setShowNewDeal(false)} onCreated={() => { setLoading(true); fetchDeals(); }} />
    </div>
    </PageTransition>
  );
}
