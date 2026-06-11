'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';

const STAGE_COLORS = [
  'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600',
  'bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700',
  'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700',
  'bg-purple-50 border-purple-300 dark:bg-purple-900/30 dark:border-purple-700',
  'bg-amber-50 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700',
  'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700',
  'bg-green-50 border-green-300 dark:bg-green-900/30 dark:border-green-700',
];

function formatCurrency(val, cur = 'UGX') {
  if (!val) return '—';
  return Number(val).toLocaleString() + ' ' + cur;
}

export default function PipelinePage() {
  const [entries, setEntries] = useState([]);
  const [stages, setStages] = useState([]);
  const [stageStats, setStageStats] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [conversionRates, setConversionRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('board'); // board | list | analytics
  const [prospects, setProspects] = useState([]);
  const [systems, setSystems] = useState([]);
  const [staff, setStaff] = useState([]);

  const emptyForm = {
    prospect_id: '', system_id: '', assigned_to: '',
    estimated_value: '', currency: 'UGX', notes: '',
  };
  const [form, setForm] = useState(emptyForm);
  const toast = useToast();

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/pipeline');
      if (res.success) {
        setEntries(res.data || []);
        setStages(res.stages || []);
        setStageStats(res.stage_stats || []);
        setAnalytics(res.analytics || {});
        setConversionRates(res.conversion_rates || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  useEffect(() => {
    fetchWithAuth('/api/prospects').then(r => { if (r.success) setProspects(r.data || []); }).catch(() => {});
    fetchWithAuth('/api/systems').then(r => { if (r.success) setSystems(r.data || r.systems || []); }).catch(() => {});
    fetchWithAuth('/api/staff').then(r => { if (r.success) setStaff(r.data || []); }).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        prospect_id: form.prospect_id || null,
        system_id: form.system_id || null,
        assigned_to: form.assigned_to || null,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      };
      const res = await fetchWithAuth('/api/pipeline', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.success) { setShowForm(false); setForm(emptyForm); toast.success('Pipeline entry created'); fetchPipeline(); }
      else toast.error(res.error || 'Failed');
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const moveStage = async (entryId, newStageId) => {
    try {
      await fetchWithAuth('/api/pipeline', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entryId, stage_id: newStageId }),
      });
      fetchPipeline();
    } catch (e) { console.error(e); }
  };

  const deleteEntry = async (id) => {
    if (!await confirmDelete('pipeline entry')) return;
    await fetchWithAuth(`/api/pipeline?id=${id}`, { method: 'DELETE' });
    toast.success('Removed from pipeline');
    fetchPipeline();
  };

  const getEntriesForStage = (stageId) => entries.filter(e => e.current_stage_id === stageId);

  const getStatForStage = (stageId) => stageStats.find(s => s.stage_id === stageId) || { count: 0, total_value: 0 };

  if (loading) return <div className="p-8 text-center opacity-60">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pipeline Intelligence</h1>
          <p className="text-sm opacity-60 mt-1">Track prospects through the sales pipeline</p>
        </div>
        <div className="flex gap-2">
          {['board', 'list', 'analytics'].map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
                ${viewMode === m ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium">
            {showForm ? 'Cancel' : '+ Add to Pipeline'}
          </button>
        </div>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border p-3 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">Pipeline Entries</div>
          <div className="text-2xl font-bold mt-1">{analytics.total_entries || 0}</div>
        </div>
        <div className="rounded-xl border p-3 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">Pipeline Value</div>
          <div className="text-2xl font-bold mt-1 text-blue-600">{formatCurrency(analytics.total_pipeline_value)}</div>
        </div>
        <div className="rounded-xl border p-3 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">Closed Deals</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">{analytics.closed_count || 0}</div>
        </div>
        <div className="rounded-xl border p-3 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">Closed Value</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">{formatCurrency(analytics.closed_value)}</div>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">Add Prospect to Pipeline</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Prospect *</label>
              <select required value={form.prospect_id} onChange={e => setForm(f => ({ ...f, prospect_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="">Select prospect...</option>
                {prospects.map(p => <option key={p.id} value={p.id}>{p.company_name || p.contact_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">System</label>
              <select value={form.system_id} onChange={e => setForm(f => ({ ...f, system_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="">— None —</option>
                {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Assigned To</label>
              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="">— Unassigned —</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Estimated Value</label>
              <input type="number" value={form.estimated_value} onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))}
                placeholder="0" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Currency</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="UGX">UGX</option><option value="USD">USD</option>
                <option value="EUR">EUR</option><option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Add to Pipeline'}
          </button>
        </form>
      )}

      {/* Board View */}
      {viewMode === 'board' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {stages.map((stage, i) => {
              const stat = getStatForStage(stage.id);
              const stageEntries = getEntriesForStage(stage.id);
              return (
                <div key={stage.id} className={`w-72 rounded-xl border-2 ${STAGE_COLORS[i % STAGE_COLORS.length]} flex flex-col`}>
                  <div className="p-3 border-b">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm">{stage.name}</span>
                      <span className="text-xs font-medium opacity-60">{stat.count}</span>
                    </div>
                    {Number(stat.total_value) > 0 && (
                      <div className="text-xs opacity-50 mt-0.5">{formatCurrency(stat.total_value)}</div>
                    )}
                  </div>
                  <div className="p-2 flex-1 space-y-2 min-h-[100px]">
                    {stageEntries.length === 0 && (
                      <div className="text-xs text-center opacity-30 py-6">No entries</div>
                    )}
                    {stageEntries.map(entry => (
                      <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border text-sm">
                        <div className="font-medium truncate">{entry.prospect_name || entry.company_name || 'Unknown'}</div>
                        <div className="text-xs opacity-50 mt-1 space-y-0.5">
                          {entry.system_name && <div>System: {entry.system_name}</div>}
                          {entry.estimated_value && <div>Value: {formatCurrency(entry.estimated_value, entry.currency)}</div>}
                          {entry.assigned_to_name && <div>Owner: {entry.assigned_to_name}</div>}
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                          <select value={stage.id}
                            onChange={e => moveStage(entry.id, e.target.value)}
                            className="text-xs border rounded px-1 py-0.5 bg-background flex-1">
                            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <button onClick={() => deleteEntry(entry.id)}
                            className="text-red-500 text-xs px-1 hover:bg-red-50 rounded dark:hover:bg-red-900/20">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-card rounded-xl border divide-y">
          {entries.length === 0 ? (
            <div className="text-center py-12 opacity-50">No pipeline entries yet</div>
          ) : entries.map(entry => (
            <div key={entry.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{entry.prospect_name || entry.company_name || 'Unknown'}</div>
                <div className="text-xs opacity-50 mt-0.5 flex gap-3 flex-wrap">
                  <span>Stage: {entry.stage_name}</span>
                  {entry.system_name && <span>System: {entry.system_name}</span>}
                  {entry.estimated_value && <span>Value: {formatCurrency(entry.estimated_value, entry.currency)}</span>}
                  {entry.assigned_to_name && <span>Owner: {entry.assigned_to_name}</span>}
                  <span>Added: {new Date(entry.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <select value={entry.current_stage_id}
                  onChange={e => moveStage(entry.id, e.target.value)}
                  className="text-xs border rounded px-2 py-1 bg-background">
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={() => deleteEntry(entry.id)}
                  className="text-red-500 text-xs px-2 py-1 hover:bg-red-50 rounded dark:hover:bg-red-900/20">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Analytics View */}
      {viewMode === 'analytics' && (
        <div className="space-y-6">
          {/* Funnel */}
          <div className="bg-card rounded-xl border p-5">
            <h2 className="font-semibold mb-4">Pipeline Funnel</h2>
            <div className="space-y-2">
              {stages.map((stage, i) => {
                const stat = getStatForStage(stage.id);
                const maxCount = Math.max(...stageStats.map(s => Number(s.count) || 0), 1);
                const width = Math.max(((Number(stat.count) / maxCount) * 100), 8);
                return (
                  <div key={stage.id} className="flex items-center gap-3">
                    <div className="w-36 text-xs font-medium text-right truncate">{stage.name}</div>
                    <div className="flex-1">
                      <div className={`h-8 rounded-lg flex items-center px-3 text-xs font-medium text-white ${STAGE_COLORS[i % STAGE_COLORS.length].includes('emerald') || STAGE_COLORS[i % STAGE_COLORS.length].includes('green') ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${width}%`, minWidth: '60px' }}>
                        {stat.count} {Number(stat.total_value) > 0 ? `(${formatCurrency(stat.total_value)})` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conversion Rates */}
          {conversionRates.length > 0 && (
            <div className="bg-card rounded-xl border p-5">
              <h2 className="font-semibold mb-4">Stage Conversion Rates</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {conversionRates.map((cr, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="text-xs opacity-60 truncate">{cr.from_stage} → {cr.to_stage}</div>
                    <div className="text-xl font-bold mt-1">
                      {Number(cr.rate || 0).toFixed(0)}%
                    </div>
                    <div className="text-xs opacity-40">{cr.converted} of {cr.total} converted</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stage Performance */}
          <div className="bg-card rounded-xl border p-5">
            <h2 className="font-semibold mb-4">Stage Distribution</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Stage</th>
                    <th className="text-right py-2 px-3 font-medium">Count</th>
                    <th className="text-right py-2 px-3 font-medium">Value</th>
                    <th className="text-right py-2 px-3 font-medium">% of Pipeline</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map(stage => {
                    const stat = getStatForStage(stage.id);
                    const totalEntries = Number(analytics.total_entries) || 1;
                    return (
                      <tr key={stage.id} className="border-b last:border-0">
                        <td className="py-2 px-3">{stage.name}</td>
                        <td className="py-2 px-3 text-right font-medium">{stat.count}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(stat.total_value)}</td>
                        <td className="py-2 px-3 text-right">{((Number(stat.count) / totalEntries) * 100).toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
