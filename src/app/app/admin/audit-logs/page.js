'use client';

import { useEffect, useState } from 'react';
import { FileText, Filter } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', entity_type: '' });

  useEffect(() => { fetchLogs(); }, [filters.action, filters.entity_type]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.action) params.set('action', filters.action);
      if (filters.entity_type) params.set('entity_type', filters.entity_type);
      params.set('limit', '100');
      const res = await fetchWithAuth(`/api/admin/audit-logs?${params}`);
      const json = await res.json();
      if (json.success) setLogs(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const ACTION_COLORS = {
    create: 'bg-emerald-100 text-emerald-700',
    update: 'bg-blue-100 text-blue-700',
    delete: 'bg-red-100 text-red-700',
    login: 'bg-purple-100 text-purple-700',
    logout: 'bg-muted text-foreground',
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">System activity and change history</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Action</label>
          <select value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))} className="px-3 py-1.5 border rounded-lg text-sm">
            <option value="">All actions</option>
            {['create','update','delete','login','logout'].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Entity Type</label>
          <select value={filters.entity_type} onChange={e => setFilters(f => ({ ...f, entity_type: e.target.value }))} className="px-3 py-1.5 border rounded-lg text-sm">
            <option value="">All types</option>
            {['prospect','client','deal','payment','expense','transfer','account','budget','offering','user','session'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No audit logs found</div>
      ) : (
        <div className="bg-card rounded-xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-muted">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-foreground">{l.user_name || l.user_email || '—'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[l.action] || 'bg-muted text-foreground'}`}>{l.action}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{l.entity_type}{l.entity_id ? ` #${l.entity_id.slice(0, 8)}` : ''}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">{l.details ? JSON.stringify(l.details) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
