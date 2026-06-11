'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Search, Filter, DollarSign, CheckCircle, Clock, Plus } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import Link from 'next/link';
import NewPaymentModal from '@/components/modals/NewPaymentModal';

const PAY_STATUS = { pending: 'bg-yellow-100 text-yellow-700', completed: 'bg-emerald-100 text-emerald-700', failed: 'bg-red-100 text-red-700', refunded: 'bg-muted text-foreground' };

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showNewPayment, setShowNewPayment] = useState(false);

  useEffect(() => { fetchPayments(); }, [statusFilter]);

  const fetchPayments = async () => {
    try {
      let url = '/api/payments';
      if (statusFilter) url += `?status=${statusFilter}`;
      const res = await fetchWithAuth(url);
      const json = await res.json();
      if (json.success) setPayments(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const totalCompleted = payments.filter(p => p.status === 'completed').reduce((s, p) => s + parseFloat(p.amount_ugx || p.amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">{payments.length} payments &middot; UGX {Math.round(totalCompleted).toLocaleString()} completed</p>
        </div>
        <button onClick={() => setShowNewPayment(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Record Payment
        </button>
      </div>

      <NewPaymentModal isOpen={showNewPayment} onClose={() => setShowNewPayment(false)} onCreated={() => { setLoading(true); fetchPayments(); }} />

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { setStatusFilter(''); setLoading(true); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!statusFilter ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>All</button>
        {['pending', 'completed', 'failed', 'refunded'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setLoading(true); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>{s}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No payments found</div>
      ) : (
        <div className="bg-card rounded-xl border divide-y">
          {payments.map(p => (
            <div key={p.id} className="flex items-center justify-between p-4 hover:bg-muted transition">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${p.status === 'completed' ? 'bg-emerald-50' : 'bg-muted'}`}>
                  <CreditCard className={`w-5 h-5 ${p.status === 'completed' ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{p.currency || 'UGX'} {Math.round(parseFloat(p.amount || 0)).toLocaleString()}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAY_STATUS[p.status]}`}>{p.status}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {p.deal_title && <Link href={`/app/deals/${p.deal_id}`} className="hover:text-blue-600">{p.deal_title}</Link>}
                    {p.client_name && <span>{p.client_name}</span>}
                    <span>{p.method?.replace(/_/g, ' ')}</span>
                    {p.reference && <span>Ref: {p.reference}</span>}
                  </div>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {p.account_name && <div className="text-muted-foreground">{p.account_name}</div>}
                <div>{new Date(p.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
