'use client';

import { useEffect, useState } from 'react';
import { Plus, Monitor, CheckCircle, Clock, AlertTriangle, TrendingUp, Key } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700',
  development: 'bg-blue-100 text-blue-700',
  deprecated: 'bg-orange-100 text-orange-700',
  archived: 'bg-muted text-muted-foreground',
};

function formatUGX(n) {
  return 'UGX ' + Math.round(parseFloat(n || 0)).toLocaleString();
}

export default function SystemsPage() {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', version: '', status: 'active' });
  const toast = useToast();

  useEffect(() => { fetchSystems(); }, []);

  const fetchSystems = async () => {
    try {
      const res = await fetchWithAuth('/api/systems');
      const json = await res.json();
      if (json.success) setSystems(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/systems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('System created');
        setSystems(prev => [json.data, ...prev]);
        setForm({ name: '', description: '', version: '', status: 'active' });
        setShowForm(false);
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const totalRevenue = systems.reduce((s, sys) => s + parseFloat(sys.total_revenue || 0), 0);
  const activeSystems = systems.filter(s => s.status === 'active').length;
  const activelyLicensed = systems.reduce((s, sys) => s + parseInt(sys.active_licenses || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Systems</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeSystems} active · {activelyLicensed} licenses issued · {formatUGX(totalRevenue)} total revenue
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> New System
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Systems</p>
          <p className="text-2xl font-bold text-foreground mt-1">{systems.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Licenses</p>
          <p className="text-2xl font-bold text-foreground mt-1">{activelyLicensed}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Revenue</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatUGX(totalRevenue)}</p>
        </div>
      </div>

      {/* New System Form */}
      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Register New System</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="System name *"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
            />
            <input
              value={form.version}
              onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
              placeholder="Version (e.g. 1.0)"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
            />
          </div>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="What does this system do?"
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
          />
          <div className="flex items-center gap-3">
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background"
            >
              <option value="active">Active</option>
              <option value="development">In Development</option>
              <option value="deprecated">Deprecated</option>
              <option value="archived">Archived</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition"
            >
              {saving ? 'Saving…' : 'Save System'}
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

      {/* Systems List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : systems.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No systems registered</p>
          <p className="text-sm mt-1">Add your first system to start tracking deals and licenses</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {systems.map(sys => (
            <Link
              key={sys.id}
              href={`/app/systems/${sys.id}`}
              className="bg-card rounded-xl border border-border p-5 hover:border-blue-400 hover:shadow-sm transition group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-blue-600 transition">{sys.name}</h3>
                  {sys.version && <p className="text-xs text-muted-foreground">v{sys.version}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[sys.status] || 'bg-muted text-muted-foreground'}`}>
                  {sys.status}
                </span>
              </div>
              {sys.description && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{sys.description}</p>
              )}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="font-semibold text-foreground">{sys.deal_count}</p>
                  <p className="text-muted-foreground">Deals</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{sys.active_licenses}</p>
                  <p className="text-muted-foreground">Licenses</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{sys.open_issues}</p>
                  <p className={`${parseInt(sys.open_issues) > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>Issues</p>
                </div>
              </div>
              {parseFloat(sys.total_revenue) > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="text-sm font-semibold text-emerald-600">{formatUGX(sys.total_revenue)}</p>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
