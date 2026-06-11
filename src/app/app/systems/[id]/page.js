'use client';

import { useEffect, useState } from 'react';
import { Plus, ArrowLeft, AlertCircle, Zap, Briefcase, Key, CheckCircle, Clock, AlertTriangle, Activity, DollarSign, Monitor, Code, Package, Trash2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { TechProfileModal } from '@/components/modals/TechProfileModal';
import { SystemModuleModal } from '@/components/modals/SystemModuleModal';
import { SystemIntelligenceTab } from '@/components/SystemIntelligenceTab';

const ISSUE_STATUS_STYLES = {
  open: 'bg-red-100 text-red-700',
  investigating: 'bg-orange-100 text-orange-700',
  fixed: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-muted text-muted-foreground',
};

const CHANGE_STATUS_STYLES = {
  planned: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

const DEAL_STATUS_STYLES = {
  draft: 'bg-muted text-foreground',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-cyan-100 text-cyan-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  negotiation: 'bg-yellow-100 text-yellow-700',
  payment_pending: 'bg-orange-100 text-orange-700',
};

function formatUGX(n) {
  return 'UGX ' + Math.round(parseFloat(n || 0)).toLocaleString();
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition ${active ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
    >
      {label}
    </button>
  );
}

export default function SystemDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showOpForm, setShowOpForm] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showTechModal, setShowTechModal] = useState(false);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issueForm, setIssueForm] = useState({ title: '', description: '', status: 'open' });
  const [changeForm, setChangeForm] = useState({ title: '', description: '', status: 'planned' });
  const [editForm, setEditForm] = useState({});
  const [opForm, setOpForm] = useState({ operation_type: 'development', description: '', status: 'completed' });
  const [planForm, setPlanForm] = useState({ name: '', description: '', installation_fee: '', monthly_fee: '', annual_fee: '', currency: 'UGX', billing_cycle: 'monthly', max_users: '', features: '' });
  const [techProfiles, setTechProfiles] = useState([]);
  const [modules, setModules] = useState([]);
  const [techLoading, setTechLoading] = useState(false);
  const [modulesLoading, setModulesLoading] = useState(false);
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [operations, setOperations] = useState([]);
  const [opsLoading, setOpsLoading] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => { if (id) fetchSystem(); }, [id]);

  useEffect(() => {
    if (tab === 'tech' && id && techProfiles.length === 0) {
      setTechLoading(true);
      fetchWithAuth(`/api/systems/${id}/tech-profiles`)
        .then(r => r.json())
        .then(j => { setTechProfiles(j.data || []); })
        .catch(console.error)
        .finally(() => setTechLoading(false));
    }
  }, [tab, id]);

  useEffect(() => {
    if (tab === 'modules' && id && modules.length === 0) {
      setModulesLoading(true);
      fetchWithAuth(`/api/systems/${id}/modules`)
        .then(r => r.json())
        .then(j => { setModules(j.data || []); })
        .catch(console.error)
        .finally(() => setModulesLoading(false));
    }
  }, [tab, id]);

  useEffect(() => {
    if (tab === 'plans' && id && plans.length === 0) {
      setPlansLoading(true);
      fetchWithAuth(`/api/systems/${id}/plans`)
        .then(r => r.json())
        .then(j => { setPlans(j.data || []); })
        .catch(console.error)
        .finally(() => setPlansLoading(false));
    }
  }, [tab, id]);

  useEffect(() => {
    if (tab === 'operations' && id && operations.length === 0) {
      setOpsLoading(true);
      fetchWithAuth(`/api/systems/${id}/operations`)
        .then(r => r.json())
        .then(j => { setOperations(j.data || []); })
        .catch(console.error)
        .finally(() => setOpsLoading(false));
    }
  }, [tab, id]);

  useEffect(() => {
    if (tab === 'timeline' && id && timelineEvents.length === 0) {
      setTimelineLoading(true);
      fetchWithAuth(`/api/events?entity_id=${id}&limit=100`)
        .then(r => r.json())
        .then(j => { setTimelineEvents(j.data || []); })
        .catch(console.error)
        .finally(() => setTimelineLoading(false));
    }
  }, [tab, id]);

  const fetchSystem = async () => {
    try {
      const res = await fetchWithAuth(`/api/systems/${id}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setEditForm({ name: json.data.name, description: json.data.description || '', version: json.data.version || '', status: json.data.status });
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const submitPlan = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const features = planForm.features ? planForm.features.split('\n').map(s => s.trim()).filter(Boolean) : [];
      const body = {
        name: planForm.name,
        description: planForm.description || null,
        installation_fee: planForm.installation_fee ? parseFloat(planForm.installation_fee) : 0,
        monthly_fee: planForm.monthly_fee ? parseFloat(planForm.monthly_fee) : 0,
        annual_fee: planForm.annual_fee ? parseFloat(planForm.annual_fee) : null,
        currency: planForm.currency,
        billing_cycle: planForm.billing_cycle,
        max_users: planForm.max_users ? parseInt(planForm.max_users) : null,
        features,
      };
      const res = await fetchWithAuth(`/api/systems/${id}/plans`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) {
        setPlans(prev => [...prev, json.data]);
        setPlanForm({ name: '', description: '', installation_fee: '', monthly_fee: '', annual_fee: '', currency: 'UGX', billing_cycle: 'monthly', max_users: '', features: '' });
        setShowPlanForm(false);
      } else {
        toast.error(json.error || 'Failed to create plan');
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const submitOperation = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/systems/${id}/operations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opForm),
      });
      const json = await res.json();
      if (json.success || json.data) {
        setOperations(prev => [json.data, ...prev]);
        setOpForm({ operation_type: 'development', description: '', status: 'completed' });
        setShowOpForm(false);
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const submitIssue = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/systems/${id}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issueForm),
      });
      const json = await res.json();
      if (json.success) {
        setData(prev => ({ ...prev, issues: [json.data, ...prev.issues] }));
        setIssueForm({ title: '', description: '', status: 'open' });
        setShowIssueForm(false);
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const submitChange = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/systems/${id}/changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changeForm),
      });
      const json = await res.json();
      if (json.success) {
        setData(prev => ({ ...prev, changes: [json.data, ...prev.changes] }));
        setChangeForm({ title: '', description: '', status: 'planned' });
        setShowChangeForm(false);
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const updateIssueStatus = async (issueId, newStatus) => {
    try {
      await fetchWithAuth(`/api/systems/${id}/issues`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: issueId, status: newStatus }),
      });
      setData(prev => ({
        ...prev,
        issues: prev.issues.map(i =>
          i.id === issueId
            ? { ...i, status: newStatus, resolved_at: (newStatus === 'fixed' || newStatus === 'closed') ? new Date().toISOString() : null }
            : i
        ),
      }));
    } catch (err) { console.error(err); }
  };

  const updateChangeStatus = async (changeId, newStatus) => {
    try {
      await fetchWithAuth(`/api/systems/${id}/changes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change_id: changeId, status: newStatus }),
      });
      setData(prev => ({
        ...prev,
        changes: prev.changes.map(c =>
          c.id === changeId ? { ...c, status: newStatus } : c
        ),
      }));
    } catch (err) { console.error(err); }
  };

  const deleteTechProfile = async (profileId) => {
    if (!confirm('Delete this tech profile?')) return;
    try {
      const res = await fetchWithAuth(`/api/systems/${id}/tech-profiles/${profileId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setTechProfiles(prev => prev.filter(p => p.id !== profileId));
        toast.success('Tech profile deleted');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete tech profile');
    }
  };

  const deleteModule = async (moduleId) => {
    if (!confirm('Delete this module?')) return;
    try {
      const res = await fetchWithAuth(`/api/systems/${id}/modules/${moduleId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setModules(prev => prev.filter(m => m.id !== moduleId));
        toast.success('Module deleted');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete module');
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/systems/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (json.success) {
        setData(prev => ({ ...prev, ...json.data }));
        setShowEditForm(false);
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!data) return <div className="p-6 text-center text-muted-foreground">System not found</div>;

  const deals = data.deals || [];
  const totalPaid = deals.reduce((s, d) => s + parseFloat(d.paid_amount || 0), 0);
  const totalRemaining = deals.reduce((s, d) => s + parseFloat(d.remaining_amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Back */}
      <Link href="/app/systems" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition w-fit">
        <ArrowLeft className="w-4 h-4" /> All Systems
      </Link>

      {/* System Header */}
      <div className="bg-card rounded-xl border border-border p-6">
        {showEditForm ? (
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="System name" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
              <input value={editForm.version} onChange={e => setEditForm(f => ({ ...f, version: e.target.value }))} placeholder="Version" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Description" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            <div className="flex gap-2">
              <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="px-3 py-2 border border-border rounded-lg bg-background text-foreground [&>option]:bg-background">
                <option value="active">Active</option>
                <option value="development">In Development</option>
                <option value="deprecated">Deprecated</option>
                <option value="archived">Archived</option>
              </select>
              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" onClick={() => setShowEditForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-foreground">{data.name}</h1>
                {data.version && <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">v{data.version}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${data.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'} dark:bg-emerald-900/30 dark:text-emerald-300`}>{data.status}</span>
              </div>
              {data.description && <p className="text-muted-foreground">{data.description}</p>}
            </div>
            <button onClick={() => setShowEditForm(true)} className="text-sm text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted transition">Edit</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Deals</p>
            <p className="text-xl font-bold text-foreground">{deals.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Revenue</p>
            <p className="text-xl font-bold text-foreground">{formatUGX(data.total_revenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Collected</p>
            <p className="text-xl font-bold text-emerald-600">{formatUGX(totalPaid)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Outstanding</p>
            <p className={`text-xl font-bold ${totalRemaining > 0 ? 'text-orange-600' : 'text-foreground'}`}>{formatUGX(totalRemaining)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <TabButton label={`Deals (${deals.length})`} active={tab === 'overview'} onClick={() => setTab('overview')} />
        <TabButton label="Intelligence" active={tab === 'intelligence'} onClick={() => setTab('intelligence')} />
        <TabButton label="Tech Stack" active={tab === 'tech'} onClick={() => setTab('tech')} />
        <TabButton label="Modules" active={tab === 'modules'} onClick={() => setTab('modules')} />
        <TabButton label={`Licenses (${(data.licenses || []).length})`} active={tab === 'licenses'} onClick={() => setTab('licenses')} />
        <TabButton label={`Plans (${plans.length})`} active={tab === 'plans'} onClick={() => setTab('plans')} />
        <TabButton label={`Issues (${(data.issues || []).length})`} active={tab === 'issues'} onClick={() => setTab('issues')} />
        <TabButton label={`Changes (${(data.changes || []).length})`} active={tab === 'changes'} onClick={() => setTab('changes')} />
        <TabButton label={`Operations (${operations.length})`} active={tab === 'operations'} onClick={() => setTab('operations')} />
        <TabButton label="Timeline" active={tab === 'timeline'} onClick={() => setTab('timeline')} />
      </div>

      {/* ── DEALS TAB ── */}
      {tab === 'overview' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Sales History</h2>
            <Link href={`/app/deals/new?system_id=${id}`} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition">
              <Plus className="w-3.5 h-3.5" /> Record Deal
            </Link>
          </div>
          {deals.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No deals recorded for this system yet</div>
          ) : (
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              {deals.map(d => {
                const paid = parseFloat(d.paid_amount || 0);
                const total = parseFloat(d.total_amount || 0);
                const pct = total > 0 ? (paid / total) * 100 : 0;
                return (
                  <div key={d.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-foreground">{d.client_label}</p>
                        <p className="text-sm text-muted-foreground">{d.title}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DEAL_STATUS_STYLES[d.status] || 'bg-muted text-muted-foreground'}`}>{d.status?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Total: <span className="text-foreground font-medium">{formatUGX(d.total_amount)}</span></span>
                      <span className="text-muted-foreground">Paid: <span className="text-emerald-600 font-medium">{formatUGX(d.paid_amount)}</span> · Remaining: <span className={`font-medium ${parseFloat(d.remaining_amount) > 0 ? 'text-orange-600' : 'text-foreground'}`}>{formatUGX(d.remaining_amount)}</span></span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── INTELLIGENCE TAB ── */}
      {tab === 'intelligence' && (
        <SystemIntelligenceTab systemId={id} systemName={data.name} />
      )}

      {/* ── TECH STACK TAB ── */}
      {tab === 'tech' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Technology Stack</h2>
            <button onClick={() => setShowTechModal(true)} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition">
              <Plus className="w-3.5 h-3.5" /> Add Tech Profile
            </button>
          </div>
          {techLoading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Loading...</div>
          ) : techProfiles.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No technology stack defined</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {techProfiles.map(tech => (
                <div key={tech.id} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between mb-3">
                    <Code className="w-5 h-5 text-blue-600" />
                    <button onClick={() => deleteTechProfile(tech.id)} className="text-muted-foreground hover:text-foreground">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2 text-sm">
                    {tech.language && <div><span className="text-muted-foreground">Language:</span> {tech.language}</div>}
                    {tech.framework && <div><span className="text-muted-foreground">Framework:</span> {tech.framework} {tech.framework_version && `v${tech.framework_version}`}</div>}
                    {tech.database && <div><span className="text-muted-foreground">Database:</span> {tech.database} {tech.db_version && `v${tech.db_version}`}</div>}
                    {tech.platform && <div><span className="text-muted-foreground">Platform:</span> {tech.platform}</div>}
                    {tech.hosting && <div><span className="text-muted-foreground">Hosting:</span> {tech.hosting}</div>}
                    {tech.deployment_url && <div><span className="text-muted-foreground">Deploy:</span> <a href={tech.deployment_url} target="_blank" className="text-blue-600 hover:underline truncate">{tech.deployment_url}</a></div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODULES TAB ── */}
      {tab === 'modules' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">System Modules</h2>
            <button onClick={() => setShowModuleModal(true)} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition">
              <Plus className="w-3.5 h-3.5" /> Add Module
            </button>
          </div>
          {modulesLoading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Loading...</div>
          ) : modules.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No modules defined</div>
          ) : (
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              {modules.map(mod => (
                <div key={mod.id} className="p-4 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-4 h-4 text-blue-600" />
                      <p className="font-medium text-foreground">{mod.module_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        mod.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        mod.status === 'inactive' ? 'bg-gray-100 text-gray-700' :
                        mod.status === 'deprecated' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      } dark:bg-blue-900/30 dark:text-blue-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:bg-orange-900/30 dark:text-orange-300`}>{mod.status}</span>
                    </div>
                    {mod.description && <p className="text-sm text-muted-foreground mb-2">{mod.description}</p>}
                    <div className="flex items-center gap-4 text-sm">
                      {mod.version && <span className="text-muted-foreground">v{mod.version}</span>}
                      {mod.module_url && <a href={mod.module_url} target="_blank" className="text-blue-600 hover:underline">Visit</a>}
                    </div>
                  </div>
                  <button onClick={() => deleteModule(mod.id)} className="text-muted-foreground hover:text-foreground ml-4">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── LICENSES TAB ── */}
      {tab === 'licenses' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Licenses</h2>
          </div>
          {(data.licenses || []).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No licenses issued for this system</div>
          ) : (
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              {data.licenses.map(l => (
                <div key={l.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{l.client_name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{l.license_type} license · {l.start_date ? new Date(l.start_date).toLocaleDateString() : 'No start date'}</p>
                    {l.notes && <p className="text-xs text-muted-foreground mt-0.5">{l.notes}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'} dark:bg-emerald-900/30 dark:text-emerald-300`}>{l.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ISSUES TAB ── */}
      {tab === 'issues' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Issues</h2>
            <button onClick={() => setShowIssueForm(!showIssueForm)} className="flex items-center gap-1 text-sm bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/20">
              <Plus className="w-3.5 h-3.5" /> Report Issue
            </button>
          </div>
          {showIssueForm && (
            <form onSubmit={submitIssue} className="bg-card rounded-xl border border-border p-4 space-y-3">
              <input required value={issueForm.title} onChange={e => setIssueForm(f => ({ ...f, title: e.target.value }))} placeholder="Issue title *" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
              <textarea value={issueForm.description} onChange={e => setIssueForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Describe the issue..." className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
              <div className="flex gap-2">
                <select value={issueForm.status} onChange={e => setIssueForm(f => ({ ...f, status: e.target.value }))} className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="fixed">Fixed</option>
                  <option value="closed">Closed</option>
                </select>
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700">Save</button>
                <button type="button" onClick={() => setShowIssueForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
              </div>
            </form>
          )}
          {(data.issues || []).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No issues reported</div>
          ) : (
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              {data.issues.map(issue => (
                <div key={issue.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{issue.title}</p>
                    {issue.description && <p className="text-sm text-muted-foreground mt-0.5">{issue.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Reported {new Date(issue.reported_at).toLocaleDateString()}
                      {issue.resolved_at && ` · Resolved ${new Date(issue.resolved_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <select
                    value={issue.status}
                    onChange={e => updateIssueStatus(issue.id, e.target.value)}
                    className={`text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer ${ISSUE_STATUS_STYLES[issue.status] || 'bg-muted text-muted-foreground'} [&>option]:bg-background`}
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="fixed">Fixed</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CHANGES TAB ── */}
      {tab === 'changes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Improvements & Changes</h2>
            <button onClick={() => setShowChangeForm(!showChangeForm)} className="flex items-center gap-1 text-sm bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/20">
              <Plus className="w-3.5 h-3.5" /> Add Change
            </button>
          </div>
          {showChangeForm && (
            <form onSubmit={submitChange} className="bg-card rounded-xl border border-border p-4 space-y-3">
              <input required value={changeForm.title} onChange={e => setChangeForm(f => ({ ...f, title: e.target.value }))} placeholder="Change title *" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
              <textarea value={changeForm.description} onChange={e => setChangeForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Describe the improvement..." className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
              <div className="flex gap-2">
                <select value={changeForm.status} onChange={e => setChangeForm(f => ({ ...f, status: e.target.value }))} className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
                  <option value="planned">Planned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700">Save</button>
                <button type="button" onClick={() => setShowChangeForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
              </div>
            </form>
          )}
          {(data.changes || []).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No changes recorded</div>
          ) : (
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              {data.changes.map(change => (
                <div key={change.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{change.title}</p>
                    {change.description && <p className="text-sm text-muted-foreground mt-0.5">{change.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Added {new Date(change.created_at).toLocaleDateString()}
                      {change.completed_at && ` · Completed ${new Date(change.completed_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <select
                    value={change.status}
                    onChange={e => updateChangeStatus(change.id, e.target.value)}
                    className={`text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer ${CHANGE_STATUS_STYLES[change.status] || 'bg-muted text-muted-foreground'} [&>option]:bg-background`}
                  >
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── OPERATIONS TAB ── */}
      {tab === 'operations' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">System Operations</h2>
            <button onClick={() => setShowOpForm(!showOpForm)} className="flex items-center gap-1 text-sm bg-purple-50 text-purple-600 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/20">
              <Plus className="w-3.5 h-3.5" /> Log Operation
            </button>
          </div>
          {showOpForm && (
            <form onSubmit={submitOperation} className="bg-card rounded-xl border border-border p-4 space-y-3">
              <select value={opForm.operation_type} onChange={e => setOpForm(f => ({ ...f, operation_type: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
                <option value="development">Development</option>
                <option value="bug_fix">Bug Fix</option>
                <option value="testing">Testing</option>
                <option value="deployment">Deployment</option>
                <option value="architecture_change">Architecture Change</option>
                <option value="maintenance">Maintenance</option>
                <option value="update">Update</option>
                <option value="other">Other</option>
              </select>
              <textarea required value={opForm.description} onChange={e => setOpForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Describe what was done..." className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
              <div className="flex gap-2">
                <select value={opForm.status} onChange={e => setOpForm(f => ({ ...f, status: e.target.value }))} className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
                  <option value="completed">Completed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="planned">Planned</option>
                </select>
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700">Save</button>
                <button type="button" onClick={() => setShowOpForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
              </div>
            </form>
          )}
          {opsLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
          ) : operations.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No operations logged for this system</div>
          ) : (
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              {operations.map(op => (
                <div key={op.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 capitalize">{op.operation_type?.replace(/_/g, ' ')}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${op.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'} dark:bg-emerald-900/30 dark:text-emerald-300`}>{op.status}</span>
                    </div>
                    <p className="text-sm text-foreground">{op.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(op.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TIMELINE TAB ── */}
      {tab === 'timeline' && (
        <div className="space-y-2">
          <h2 className="font-semibold text-foreground mb-4">System Timeline</h2>
          {timelineLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 pt-1 space-y-2"><div className="h-3 bg-muted rounded w-3/4" /><div className="h-2 bg-muted rounded w-1/3" /></div>
                </div>
              ))}
            </div>
          ) : timelineEvents.length === 0 ? (
            <div className="text-center py-10">
              <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-muted-foreground text-sm">No timeline events yet for this system.</p>
              <p className="text-xs text-muted-foreground mt-1">Events are recorded when you create deals, report issues, and more.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-1">
                {timelineEvents.map((event, i) => {
                  const icons = {
                    system_created: { icon: Monitor, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
                    deal_created:   { icon: Briefcase, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
                    deal_closed:    { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
                    payment_received: { icon: DollarSign, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
                    issue_reported: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
                    issue_fixed:    { icon: CheckCircle, color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30' },
                    license_issued: { icon: Key, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
                  };
                  const cfg = icons[event.event_type] || { icon: Activity, color: 'text-muted-foreground', bg: 'bg-muted' };
                  const Icon = cfg.icon;
                  return (
                    <div key={event.id} className="flex items-start gap-3 pl-0 py-2">
                      <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${cfg.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 pb-2">
                        <p className="text-sm text-foreground">{event.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <TechProfileModal
        isOpen={showTechModal}
        onClose={() => setShowTechModal(false)}
        systemId={id}
        onSuccess={() => { setTechProfiles([]); setTab('tech'); }}
      />

      <SystemModuleModal
        isOpen={showModuleModal}
        onClose={() => setShowModuleModal(false)}
        systemId={id}
        onSuccess={() => { setModules([]); setTab('modules'); }}
      />
    </div>
  );
}
