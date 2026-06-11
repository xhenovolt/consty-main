'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Building2, ChevronRight, Handshake } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';
import NewClientModal from '@/components/modals/NewClientModal';

const STATUS_COLORS = {
  active: 'bg-emerald-100 text-emerald-700', inactive: 'bg-muted text-muted-foreground',
  suspended: 'bg-orange-100 text-orange-700', churned: 'bg-red-100 text-red-700',
};

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const toast = useToast();

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    try {
      let url = '/api/clients';
      if (search) url += `?search=${encodeURIComponent(search)}`;
      const res = await fetchWithAuth(url);
      const json = await res.json();
      if (json.success) setClients(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">{clients.length} clients</p>
        </div>
        <button onClick={() => setShowNewClient(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      <NewClientModal isOpen={showNewClient} onClose={() => setShowNewClient(false)} onCreated={() => { setLoading(true); fetchClients(); }} />

      <form onSubmit={e => { e.preventDefault(); setLoading(true); fetchClients(); }} className="relative w-64">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." className="border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-full bg-background text-foreground" />
      </form>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No clients yet. Convert prospects or add directly.</div>
      ) : (
        <div className="bg-card rounded-xl border divide-y">
          {clients.map(c => (
            <Link key={c.id} href={`/app/clients/${c.id}`} className="flex items-center justify-between p-4 hover:bg-muted transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{c.company_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {c.contact_name && <span>{c.contact_name}</span>}
                    {c.deal_count > 0 && <span className="ml-3"><Handshake className="w-3 h-3 inline" /> {c.deal_count} deals</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {parseFloat(c.total_deal_value) > 0 && (
                  <span className="text-sm font-medium text-foreground">{formatCurrency(c.total_deal_value)}</span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
