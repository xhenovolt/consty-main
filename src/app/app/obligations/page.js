'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';

const PRIORITY_COLORS = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const STATUS_COLORS = {
  pending: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export default function ObligationsPage() {
  const [obligations, setObligations] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [clients, setClients] = useState([]);
  const [deals, setDeals] = useState([]);
  const [systems, setSystems] = useState([]);
  const [staff, setStaff] = useState([]);

  const emptyForm = {
    title: '', description: '', deal_id: '', client_id: '', system_id: '',
    priority: 'medium', status: 'pending', assigned_to: '', due_date: '', notes: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [templateForm, setTemplateForm] = useState({ deal_id: '', client_id: '', system_id: '' });
  const toast = useToast();

  const fetchObligations = useCallback(async () => {
    try {
      let url = '/api/obligations?';
      if (filterStatus) url += `status=${filterStatus}&`;
      const res = await fetchWithAuth(url);
      if (res.success) {
        setObligations(res.data || []);
        setSummary(res.summary || {});
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { fetchObligations(); }, [fetchObligations]);

  useEffect(() => {
    fetchWithAuth('/api/clients').then(r => { if (r.success) setClients(r.data || []); }).catch(() => {});
    fetchWithAuth('/api/deals').then(r => { if (r.success) setDeals(r.data || []); }).catch(() => {});
    fetchWithAuth('/api/systems').then(r => { if (r.success) setSystems(r.data || r.systems || []); }).catch(() => {});
    fetchWithAuth('/api/staff').then(r => { if (r.success) setStaff(r.data || []); }).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        deal_id: form.deal_id || null,
        client_id: form.client_id || null,
        system_id: form.system_id || null,
        assigned_to: form.assigned_to || null,
        due_date: form.due_date || null,
      };
      const res = await fetchWithAuth('/api/obligations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.success) { setShowForm(false); setForm(emptyForm); fetchObligations(); toast.success('Obligation created'); }
      else toast.error(res.error || 'Failed');
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const submitTemplate = async (e) => {
    e.preventDefault();
    if (!templateForm.system_id) { toast.error('Select a system'); return; }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/obligations', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForm),
      });
      if (res.success) {
        setShowTemplate(false);
        setTemplateForm({ deal_id: '', client_id: '', system_id: '' });
        fetchObligations();
        toast.success(`Created ${res.count} obligations from template`);
      } else toast.error(res.error || 'Failed');
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await fetchWithAuth('/api/obligations', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      fetchObligations();
    } catch (e) { console.error(e); }
  };

  const deleteObligation = async (id) => {
    if (!await confirmDelete('obligation')) return;
    await fetchWithAuth(`/api/obligations?id=${id}`, { method: 'DELETE' });
    toast.success('Obligation deleted');
    fetchObligations();
  };

  const isOverdue = (o) => o.due_date && o.status !== 'completed' && new Date(o.due_date) < new Date();

  if (loading) return <div className="p-8 text-center opacity-60">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Client Obligations</h1>
          <p className="text-sm opacity-60 mt-1">Track what the company owes clients after deals close</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowTemplate(!showTemplate); setShowForm(false); }}
            className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted">
            From Template
          </button>
          <button onClick={() => { setShowForm(!showForm); setShowTemplate(false); }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium">
            {showForm ? 'Cancel' : '+ Add Obligation'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border p-3 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">Total</div>
          <div className="text-2xl font-bold mt-1">{summary.total || 0}</div>
        </div>
        <div className="rounded-xl border p-3 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">Pending</div>
          <div className="text-2xl font-bold mt-1 text-slate-600">{summary.pending || 0}</div>
        </div>
        <div className="rounded-xl border p-3 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">In Progress</div>
          <div className="text-2xl font-bold mt-1 text-blue-600">{summary.in_progress || 0}</div>
        </div>
        <div className="rounded-xl border p-3 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">Completed</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">{summary.completed || 0}</div>
        </div>
        <div className="rounded-xl border p-3 bg-card">
          <div className="text-xs font-medium opacity-60 uppercase">Blocked</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{summary.blocked || 0}</div>
        </div>
        <div className="rounded-xl border p-3 bg-card border-red-200 dark:border-red-800">
          <div className="text-xs font-medium text-red-600 uppercase">Overdue</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{summary.overdue || 0}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'in_progress', 'completed', 'blocked'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
              ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {s ? s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'All'}
          </button>
        ))}
      </div>

      {/* Template Form */}
      {showTemplate && (
        <form onSubmit={submitTemplate} className="bg-card rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">Create Obligations from System Template</h2>
          <p className="text-sm opacity-60">Automatically generate standard obligations for a system deployment</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">System *</label>
              <select required value={templateForm.system_id} onChange={e => setTemplateForm(f => ({ ...f, system_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="">Select system...</option>
                {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Client</label>
              <select value={templateForm.client_id} onChange={e => setTemplateForm(f => ({ ...f, client_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="">— None —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Deal</label>
              <select value={templateForm.deal_id} onChange={e => setTemplateForm(f => ({ ...f, deal_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="">— None —</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Creating...' : 'Generate Obligations'}
          </button>
        </form>
      )}

      {/* Manual Form */}
      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">Add Obligation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium mb-1 opacity-70">Title *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Install fingerprint attendance device" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Client</label>
              <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="">— None —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">Deal</label>
              <select value={form.deal_id} onChange={e => setForm(f => ({ ...f, deal_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="">— None —</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
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
              <label className="block text-xs font-medium mb-1 opacity-70">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                <option value="low">Low</option><option value="medium">Medium</option>
                <option value="high">High</option><option value="critical">Critical</option>
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
              <label className="block text-xs font-medium mb-1 opacity-70">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium mb-1 opacity-70">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Add Obligation'}
          </button>
        </form>
      )}

      {/* Obligations List */}
      {obligations.length === 0 ? (
        <div className="text-center py-16 opacity-50">
          <p className="text-lg font-medium">No obligations found</p>
          <p className="text-sm mt-1">Create obligations manually or generate from system templates</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border divide-y">
          {obligations.map(o => (
            <div key={o.id} className={`p-4 flex items-start justify-between gap-4 ${isOverdue(o) ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`font-medium ${o.status === 'completed' ? 'line-through opacity-50' : ''}`}>{o.title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[o.priority]}`}>{o.priority}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]}`}>{o.status.replace('_', ' ')}</span>
                  {isOverdue(o) && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">OVERDUE</span>}
                </div>
                <div className="text-xs opacity-50 mt-0.5 flex gap-3 flex-wrap">
                  {o.client_name && <span>Client: {o.client_name}</span>}
                  {o.system_name && <span>System: {o.system_name}</span>}
                  {o.deal_title && <span>Deal: {o.deal_title}</span>}
                  {o.assigned_to_name && <span>Assigned: {o.assigned_to_name}</span>}
                  {o.due_date && <span>Due: {new Date(o.due_date).toLocaleDateString()}</span>}
                </div>
                {o.description && <p className="text-xs opacity-40 mt-1">{o.description}</p>}
              </div>
              <div className="flex gap-1 shrink-0 items-center flex-wrap">
                {o.status !== 'completed' && (
                  <select value={o.status}
                    onChange={e => updateStatus(o.id, e.target.value)}
                    className="text-xs border rounded px-1.5 py-1 bg-background">
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                  </select>
                )}
                <button onClick={() => deleteObligation(o.id)}
                  className="p-1 rounded hover:bg-red-50 text-red-500 text-xs dark:hover:bg-red-900/20">Del</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
