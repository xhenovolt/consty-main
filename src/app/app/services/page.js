'use client';

import { useEffect, useState } from 'react';
import { Plus, Package, RefreshCw, Zap, TrendingUp, Briefcase } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const TYPE_STYLES = {
  one_time: 'bg-blue-100 text-blue-700',
  recurring: 'bg-purple-100 text-purple-700',
};

function formatUGX(n) {
  return 'UGX ' + Math.round(parseFloat(n || 0)).toLocaleString();
}

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', service_type: 'one_time', price: '', currency: 'UGX',
  });
  const toast = useToast();

  useEffect(() => { fetchServices(); }, []);

  const fetchServices = async () => {
    try {
      const res = await fetchWithAuth('/api/services');
      const json = await res.json();
      if (json.success) setServices(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, price: form.price ? parseFloat(form.price) : null }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Service created');
        setServices(prev => [json.data, ...prev]);
        setForm({ name: '', description: '', service_type: 'one_time', price: '', currency: 'UGX' });
        setShowForm(false);
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const totalRevenue = services.reduce((s, svc) => s + parseFloat(svc.total_revenue || 0), 0);
  const recurringCount = services.filter(s => s.service_type === 'recurring').length;
  const oneTimeCount = services.filter(s => s.service_type === 'one_time').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Services</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {services.length} services · {recurringCount} recurring · {oneTimeCount} one-time · {formatUGX(totalRevenue)} total revenue
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> New Service
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Services</p>
          <p className="text-2xl font-bold text-foreground mt-1">{services.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Recurring Services</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{recurringCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Revenue</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatUGX(totalRevenue)}</p>
        </div>
      </div>

      {/* New Service Form */}
      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Register New Service</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Service name *"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
            />
            <select
              value={form.service_type}
              onChange={e => setForm(f => ({ ...f, service_type: e.target.value }))}
              className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background"
            >
              <option value="one_time">One-Time</option>
              <option value="recurring">Recurring</option>
            </select>
          </div>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="What does this service include?"
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground w-10 shrink-0">Price</span>
              <div className="flex items-center gap-1 flex-1 border border-border rounded-lg overflow-hidden">
                <select
                  value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="px-2 py-2 bg-muted text-foreground text-sm border-r border-border [&>option]:bg-background outline-none"
                >
                  <option value="UGX">UGX</option>
                  <option value="USD">USD</option>
                  <option value="KES">KES</option>
                </select>
                <input
                  type="number"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="Amount"
                  className="flex-1 px-3 py-2 bg-background text-foreground text-sm outline-none"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition"
            >
              {saving ? 'Saving…' : 'Save Service'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Services List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : services.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No services registered</p>
          <p className="text-sm mt-1">Add services to track what you sell</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(svc => (
            <div
              key={svc.id}
              className="bg-card rounded-xl border border-border p-5 hover:border-blue-400 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-foreground">{svc.name}</h3>
                  {svc.price && (
                    <p className="text-sm font-medium text-emerald-600 mt-0.5">
                      {svc.currency} {Math.round(parseFloat(svc.price)).toLocaleString()}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLES[svc.service_type] || 'bg-muted text-muted-foreground'}`}>
                  {svc.service_type === 'one_time' ? 'One-Time' : 'Recurring'}
                </span>
              </div>
              {svc.description && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{svc.description}</p>
              )}
              <div className="grid grid-cols-2 gap-2 text-center text-xs border-t border-border pt-3 mt-auto">
                <div>
                  <p className="font-semibold text-foreground">{svc.deal_count || 0}</p>
                  <p className="text-muted-foreground">Deals</p>
                </div>
                <div>
                  <p className="font-semibold text-emerald-600">{formatUGX(svc.total_revenue)}</p>
                  <p className="text-muted-foreground">Revenue</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
