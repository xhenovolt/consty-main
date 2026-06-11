'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileText, Search, Download, Eye, Calendar, Filter, ChevronLeft, ChevronRight, DollarSign, Building2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import Link from 'next/link';
import { SkeletonInvoices } from '@/components/ui/Skeleton';
import { PageTransition } from '@/components/ui/PageTransition';

const STATUS_COLORS = {
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

const fmtCurrency = (amount, currency = 'UGX') => {
  const n = parseFloat(amount || 0);
  return `${currency} ${n.toLocaleString()}`;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [stats, setStats] = useState({ total: 0, totalAmount: 0, thisMonth: 0 });

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetchWithAuth(`/api/invoices?${params}`);
      const json = res.json ? await res.json() : res;
      if (json.success) {
        setInvoices(json.data);
        setPagination(json.pagination);
        // Compute stats from current data
        const totalAmount = json.data.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
        const thisMonth = json.data.filter(i => {
          const d = new Date(i.issued_date);
          const now = new Date();
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;
        setStats({ total: json.pagination.total, totalAmount, thisMonth });
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, statusFilter, dateFrom, dateTo, page]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handlePreview = (id) => {
    window.open(`/api/invoices/${id}/pdf`, '_blank');
  };

  return (
    <PageTransition>
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
        <p className="text-sm text-muted-foreground mt-1">Professional invoices generated for every payment transaction</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><FileText className="w-3.5 h-3.5" />Total Invoices</div>
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><DollarSign className="w-3.5 h-3.5" />Invoiced Amount</div>
          <div className="text-2xl font-bold text-emerald-600">{fmtCurrency(stats.totalAmount)}</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Calendar className="w-3.5 h-3.5" />This Month</div>
          <div className="text-2xl font-bold text-blue-600">{stats.thisMonth}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text" placeholder="Search by client, invoice number, or deal..."
                value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-background"
              />
            </div>
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg text-sm bg-background">
            <option value="">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg text-sm bg-background" placeholder="From" />
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg text-sm bg-background" placeholder="To" />
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-card rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8">
            <SkeletonInvoices count={5} />
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No invoices found</p>
            <p className="text-xs text-muted-foreground mt-1">Invoices are generated automatically when payments are recorded</p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[140px_1fr_140px_120px_100px_100px] gap-2 px-4 py-2.5 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>Invoice #</span><span>Client / Deal</span><span>Amount</span><span>Date</span><span>Status</span><span>Actions</span>
            </div>
            <div className="divide-y">
              {invoices.map(inv => (
                <div key={inv.id} className="grid grid-cols-1 md:grid-cols-[140px_1fr_140px_120px_100px_100px] gap-2 px-4 py-3 hover:bg-muted/30 transition-colors items-center">
                  <span className="font-mono text-sm font-medium text-blue-600">{inv.invoice_number}</span>
                  <div>
                    <div className="text-sm font-medium text-foreground">{inv.client_name}</div>
                    <div className="text-xs text-muted-foreground">{inv.deal_title}</div>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{fmtCurrency(inv.amount, inv.currency)}</span>
                  <span className="text-sm text-muted-foreground">{new Date(inv.issued_date).toLocaleDateString()}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium w-fit ${STATUS_COLORS[inv.status] || ''}`}>{inv.status}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handlePreview(inv.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Preview">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => handlePreview(inv.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Download">
                      <Download className="w-4 h-4" />
                    </button>
                    <Link href={`/app/deals/${inv.deal_id}`} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="View Deal">
                      <Building2 className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="p-2 rounded-lg border hover:bg-muted disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-medium">Page {page} of {pagination.totalPages}</span>
            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
              className="p-2 rounded-lg border hover:bg-muted disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
