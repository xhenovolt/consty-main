'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Trash2, Users, ListTree, LayoutDashboard, ShieldCheck,
  CalendarDays, Wallet, Package, ArrowLeftRight, ShoppingCart,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import { PageTransition } from '@/components/ui/PageTransition';

const TYPE_LABEL = { stage: 'Stage', milestone: 'Milestone', work_package: 'Work Package', task: 'Task', subtask: 'Subtask' };
const TYPE_ORDER = ['stage', 'milestone', 'work_package', 'task', 'subtask'];
const childTypeOf = (t) => TYPE_ORDER[Math.min(TYPE_ORDER.indexOf(t) + 1, TYPE_ORDER.length - 1)];
const STATUS = ['not_started', 'in_progress', 'blocked', 'in_review', 'done', 'cancelled'];
const HEALTH_DOT = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' };
const field = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [addParent, setAddParent] = useState(undefined); // undefined = closed; null = root
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/projects/${id}`);
      const json = await res.json();
      if (json.success) setProject(json.data);
      else toast.error?.(json.error || 'Failed to load project');
    } catch { toast.error?.('Failed to load project'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchWithAuth('/api/users').then(r => r.json()).then(j => j.success && setUsers(j.data)).catch(() => {}); }, []);

  const canEdit = project?.access?.canEdit;
  const canManageMembers = project?.access?.canManageMembers;

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading project…</div>;
  if (!project) return <div className="p-6 text-sm text-muted-foreground">Project not found.</div>;

  const items = project.work_items || [];
  const byParent = items.reduce((m, w) => { (m[w.parent_id || 'root'] ||= []).push(w); return m; }, {});

  const patchProject = async (patch) => {
    const res = await fetchWithAuth(`/api/projects/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (json.success) load(); else toast.error?.(json.error || 'Update failed');
  };

  return (
    <PageTransition>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <Link href="/app/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={15} /> Projects
        </Link>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${HEALTH_DOT[project.health] || 'bg-muted'}`} />
              <span className="text-xs font-mono text-muted-foreground">{project.code}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mt-1">{project.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <select disabled={!canEdit} value={project.status} onChange={(e) => patchProject({ status: e.target.value })}
              className={`${field} w-auto`} title="Project status">
              {['draft','planning','approved','active','on_hold','frozen','closing','closed','cancelled'].map(s =>
                <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-5">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Overall progress</span><span>{Math.round(Number(project.progress_pct) || 0)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, Number(project.progress_pct) || 0)}%` }} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-5">
          {[['overview', 'Overview', LayoutDashboard], ['work', 'Work', ListTree], ['budget', 'Budget', Wallet], ['resources', 'Resources', Package], ['procurement', 'Procurement', ShoppingCart], ['team', 'Team', Users]].map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {tab === 'overview' && <Overview project={project} />}
        {tab === 'work' && (
          <WorkTab items={items} byParent={byParent} canEdit={canEdit} projectId={id}
            users={users} onAdd={(parent) => setAddParent(parent)} onChanged={load} toast={toast} />
        )}
        {tab === 'budget' && (
          <BudgetTab projectId={id} canEdit={canEdit} currency={project.currency} toast={toast} onChanged={load} />
        )}
        {tab === 'resources' && (
          <ResourcesTab projectId={id} canEdit={canEdit} currency={project.currency} toast={toast} />
        )}
        {tab === 'procurement' && (
          <ProcurementTab projectId={id} canEdit={canEdit} currency={project.currency} toast={toast} />
        )}
        {tab === 'team' && (
          <TeamTab project={project} users={users} canManageMembers={canManageMembers}
            projectId={id} onChanged={load} toast={toast} />
        )}
      </div>

      {addParent !== undefined && (
        <AddNodeModal projectId={id} parent={addParent} users={users}
          onClose={() => setAddParent(undefined)} onAdded={() => { setAddParent(undefined); load(); }} toast={toast} />
      )}
    </PageTransition>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Icon size={14} /> {label}</div>
      <div className="text-sm font-medium text-foreground">{value ?? '—'}</div>
    </div>
  );
}

function Overview({ project }) {
  const b = project.budget;
  const fmt = (d) => d ? new Date(d).toLocaleDateString() : '—';
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Stat icon={ShieldCheck} label="Governor / Sponsor" value={project.governor_name} />
      <Stat icon={ShieldCheck} label="Project Manager" value={project.manager_name} />
      <Stat icon={Users} label="Client" value={project.client_name} />
      <Stat icon={CalendarDays} label="Planned" value={`${fmt(project.planned_start)} → ${fmt(project.planned_end)}`} />
      <Stat icon={CalendarDays} label="Actual" value={`${fmt(project.actual_start)} → ${fmt(project.actual_end)}`} />
      <Stat icon={ListTree} label="Type / Priority" value={`${project.type} · ${project.priority}`} />
      <Stat icon={Wallet} label="Budget allocated"
        value={b ? `${project.currency} ${Number(b.allocated).toLocaleString()}` : 'No budget set'} />
      <Stat icon={Wallet} label="Budget status" value={b?.status || '—'} />
      <Stat icon={ListTree} label="Work items" value={(project.work_items || []).length} />
      {project.description && (
        <div className="sm:col-span-2 lg:col-span-3 bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Description</div>
          <p className="text-sm text-foreground whitespace-pre-wrap">{project.description}</p>
        </div>
      )}
    </div>
  );
}

function WorkTab({ items, byParent, canEdit, projectId, onAdd, onChanged, toast }) {
  if (items.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl py-12 text-center">
        <ListTree className="w-9 h-9 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-foreground font-medium">No work breakdown yet</p>
        <p className="text-sm text-muted-foreground mt-1 mb-4">Add stages, then milestones, work packages, tasks and subtasks.</p>
        {canEdit && <button onClick={() => onAdd(null)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Plus size={16} /> Add Stage</button>}
      </div>
    );
  }
  return (
    <div>
      {canEdit && (
        <div className="mb-3">
          <button onClick={() => onAdd(null)} className="inline-flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted/50"><Plus size={15} /> Add Stage</button>
        </div>
      )}
      <div className="space-y-1">
        {(byParent.root || []).map((node) => (
          <WorkNode key={node.id} node={node} byParent={byParent} depth={0}
            canEdit={canEdit} projectId={projectId} onAdd={onAdd} onChanged={onChanged} toast={toast} />
        ))}
      </div>
    </div>
  );
}

function WorkNode({ node, byParent, depth, canEdit, projectId, onAdd, onChanged, toast }) {
  const children = byParent[node.id] || [];
  const hasChildren = children.length > 0;
  const [prog, setProg] = useState(Math.round(Number(node.progress_pct) || 0));

  const patch = async (body) => {
    const res = await fetchWithAuth(`/api/projects/${projectId}/work-items/${node.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.success) onChanged(); else toast.error?.(json.error || 'Update failed');
  };
  const remove = async () => {
    if (!confirm(`Delete "${node.name}" and everything under it?`)) return;
    const res = await fetchWithAuth(`/api/projects/${projectId}/work-items/${node.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) onChanged(); else toast.error?.(json.error || 'Delete failed');
  };

  return (
    <div>
      <div className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-muted/40 group" style={{ paddingLeft: depth * 18 + 8 }}>
        <span className="text-[10px] uppercase font-semibold text-muted-foreground w-20 shrink-0">{TYPE_LABEL[node.type]}</span>
        <span className="text-sm text-foreground flex-1 min-w-0 truncate">{node.name}</span>

        {canEdit ? (
          <select value={node.status} onChange={(e) => patch({ status: e.target.value })}
            className="text-xs bg-background border border-border rounded px-1.5 py-1">
            {STATUS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        ) : <span className="text-xs text-muted-foreground">{node.status.replace('_', ' ')}</span>}

        {/* progress: editable on leaves, rolled-up (read-only) on branches */}
        <div className="w-28 shrink-0 flex items-center gap-1.5">
          <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, Number(node.progress_pct) || 0)}%` }} />
          </div>
          {hasChildren ? (
            <span className="text-xs text-muted-foreground w-9 text-right">{Math.round(Number(node.progress_pct) || 0)}%</span>
          ) : canEdit ? (
            <input type="number" min={0} max={100} value={prog}
              onChange={(e) => setProg(e.target.value)}
              onBlur={() => Number(prog) !== Math.round(Number(node.progress_pct) || 0) && patch({ progress_pct: Math.max(0, Math.min(100, Number(prog) || 0)) })}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="w-12 text-xs bg-background border border-border rounded px-1 py-0.5 text-right" />
          ) : <span className="text-xs text-muted-foreground w-9 text-right">{Math.round(Number(node.progress_pct) || 0)}%</span>}
        </div>

        {canEdit && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
            {node.type !== 'subtask' && (
              <button onClick={() => onAdd(node)} title={`Add ${TYPE_LABEL[childTypeOf(node.type)]}`}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Plus size={14} /></button>
            )}
            <button onClick={remove} title="Delete" className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
      {hasChildren && children.map((c) => (
        <WorkNode key={c.id} node={c} byParent={byParent} depth={depth + 1}
          canEdit={canEdit} projectId={projectId} onAdd={onAdd} onChanged={onChanged} toast={toast} />
      ))}
    </div>
  );
}

function AddNodeModal({ projectId, parent, users, onClose, onAdded, toast }) {
  const defaultType = parent ? childTypeOf(parent.type) : 'stage';
  const [form, setForm] = useState({ name: '', type: defaultType, owner_id: '', planned_start: '', planned_end: '', weight: 1 });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name.trim()) { toast.error?.('Name is required'); return; }
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/work-items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, type: form.type, parent_id: parent?.id || null,
          owner_id: form.owner_id || null, planned_start: form.planned_start || null,
          planned_end: form.planned_end || null, weight: Number(form.weight) || 1,
        }),
      });
      const json = await res.json();
      if (json.success) { toast.success?.('Added'); onAdded(); } else toast.error?.(json.error || 'Failed to add');
    } catch { toast.error?.('Failed to add'); } finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Add ${TYPE_LABEL[defaultType]}`}
      subtitle={parent ? `Under: ${parent.name}` : 'Top-level stage'}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted/50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-60">{saving ? 'Adding…' : 'Add'}</button>
        </div>
      }>
      <div className="space-y-4">
        <div><label className="block text-sm font-medium mb-1">Name *</label>
          <input className={field} value={form.name} onChange={set('name')} autoFocus /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium mb-1">Type</label>
            <select className={field} value={form.type} onChange={set('type')}>
              {TYPE_ORDER.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium mb-1">Weight</label>
            <input type="number" min={0.1} step={0.1} className={field} value={form.weight} onChange={set('weight')} /></div>
        </div>
        <div><label className="block text-sm font-medium mb-1">Owner</label>
          <select className={field} value={form.owner_id} onChange={set('owner_id')}>
            <option value="">— Unassigned —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
          </select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium mb-1">Planned start</label>
            <input type="date" className={field} value={form.planned_start} onChange={set('planned_start')} /></div>
          <div><label className="block text-sm font-medium mb-1">Planned end</label>
            <input type="date" className={field} value={form.planned_end} onChange={set('planned_end')} /></div>
        </div>
      </div>
    </Modal>
  );
}

const BUDGET_STATUS_STYLE = {
  surplus: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  balanced: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  tight: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  deficit: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  frozen: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  overrun: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
const FUNDING_TYPES = ['company_wallet','client_deposit','external_funder','loan','grant','donor','retained_earnings','manual_external'];

function BudgetTab({ projectId, canEdit, currency, toast, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alloc, setAlloc] = useState('');
  const [forecast, setForecast] = useState('');
  const [frozen, setFrozen] = useState(false);
  const [fund, setFund] = useState({ source_type: 'company_wallet', name: '', amount: '', status: 'pledged' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/budget`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setAlloc(json.data.budget?.allocated_amount ?? '');
        setForecast(json.data.budget?.forecast_amount ?? '');
        setFrozen(!!json.data.budget?.is_frozen);
      }
    } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const money = (v) => `${currency} ${Number(v || 0).toLocaleString()}`;

  const saveBudget = async () => {
    const res = await fetchWithAuth(`/api/projects/${projectId}/budget`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allocated_amount: Number(alloc) || 0, forecast_amount: forecast === '' ? null : Number(forecast), is_frozen: frozen, currency }),
    });
    const json = await res.json();
    if (json.success) { toast.success?.('Budget saved'); load(); onChanged?.(); } else toast.error?.(json.error || 'Failed');
  };
  const addFunding = async () => {
    const res = await fetchWithAuth(`/api/projects/${projectId}/funding`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fund, amount: Number(fund.amount) || 0, currency }),
    });
    const json = await res.json();
    if (json.success) { toast.success?.('Funding source added'); setFund({ source_type: 'company_wallet', name: '', amount: '', status: 'pledged' }); load(); }
    else toast.error?.(json.error || 'Failed');
  };
  const delFunding = async (fid) => {
    const res = await fetchWithAuth(`/api/projects/${projectId}/funding?fundingId=${fid}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) load(); else toast.error?.(json.error || 'Failed');
  };

  if (loading) return <div className="text-sm text-muted-foreground py-8">Loading budget…</div>;
  const c = data?.computed || {};
  const fundShort = c.funding_total < c.allocated;

  return (
    <div className="space-y-5">
      {/* Computed cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat icon={Wallet} label="Allocated" value={money(c.allocated)} />
        <Stat icon={Wallet} label="Committed" value={money(c.committed)} />
        <Stat icon={Wallet} label="Actual spent" value={money(c.actual)} />
        <Stat icon={Wallet} label="Forecast" value={money(c.forecast)} />
        <Stat icon={Wallet} label="Remaining" value={money(c.remaining)} />
        <Stat icon={Wallet} label="Variance" value={money(c.variance)} />
        <Stat icon={Wallet} label="Funding pledged" value={money(c.funding_total)} />
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Status</div>
          {c.status
            ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${BUDGET_STATUS_STYLE[c.status] || 'bg-muted'}`}>{c.status}</span>
            : <span className="text-sm text-muted-foreground">No budget set</span>}
        </div>
      </div>

      {fundShort && c.allocated > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          <Wallet size={15} /> Funding pledged ({money(c.funding_total)}) is below the allocated budget ({money(c.allocated)}).
        </div>
      )}

      {/* Set budget */}
      {canEdit && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Set budget</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div><label className="block text-xs text-muted-foreground mb-1">Allocated ({currency})</label>
              <input type="number" className={`${field} w-40`} value={alloc} onChange={(e) => setAlloc(e.target.value)} /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">Forecast (optional)</label>
              <input type="number" className={`${field} w-40`} value={forecast} onChange={(e) => setForecast(e.target.value)} placeholder="auto" /></div>
            <label className="inline-flex items-center gap-2 text-sm pb-2">
              <input type="checkbox" checked={frozen} onChange={(e) => setFrozen(e.target.checked)} /> Freeze spending
            </label>
            <button onClick={saveBudget} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium">Save</button>
          </div>
        </div>
      )}

      {/* Funding sources */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Funding sources</h3>
        </div>
        {canEdit && (
          <div className="p-3 flex flex-wrap items-end gap-2 border-b border-border">
            <select className={`${field} w-44`} value={fund.source_type} onChange={(e) => setFund(f => ({ ...f, source_type: e.target.value }))}>
              {FUNDING_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            <input className={`${field} flex-1 min-w-[120px]`} placeholder="Name / reference" value={fund.name} onChange={(e) => setFund(f => ({ ...f, name: e.target.value }))} />
            <input type="number" className={`${field} w-32`} placeholder="Amount" value={fund.amount} onChange={(e) => setFund(f => ({ ...f, amount: e.target.value }))} />
            <select className={`${field} w-32`} value={fund.status} onChange={(e) => setFund(f => ({ ...f, status: e.target.value }))}>
              {['pledged','received','spent'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={addFunding} className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium"><Plus size={15} /> Add</button>
          </div>
        )}
        {(data?.funding_sources?.length ?? 0) === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">No funding sources yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {data.funding_sources.map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-3 text-sm">
                <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">{f.source_type.replace(/_/g, ' ')}</span>
                <span className="flex-1 min-w-0 truncate text-foreground">{f.name || '—'}</span>
                <span className="text-muted-foreground">{f.status}</span>
                <span className="font-medium text-foreground">{money(f.amount)}</span>
                {canEdit && <button onClick={() => delFunding(f.id)} className="p-1.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600"><Trash2 size={15} /></button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const RESOURCE_CATEGORIES = ['material','equipment','vehicle','tool','fuel','labour','subcontractor',
  'consumable','reusable_asset','water','power','permit','document','staff','money'];
const MOVEMENT_TYPES = ['receive','consume','return','waste','transfer','issue','store','inspect','adjust'];
const CONDITIONS = ['new','refurbished','used','damaged','expired'];

function ResourcesTab({ projectId, canEdit, currency, toast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [moveFor, setMoveFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/resources`);
      const json = await res.json();
      if (json.success) setRows(json.data);
    } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const del = async (rid) => {
    if (!confirm('Delete this resource?')) return;
    const res = await fetchWithAuth(`/api/projects/${projectId}/resources/${rid}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) load(); else toast.error?.(json.error || 'Failed');
  };

  if (loading) return <div className="text-sm text-muted-foreground py-8">Loading resources…</div>;
  return (
    <div className="space-y-4">
      {canEdit && (
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted/50">
          <Plus size={15} /> Add Resource
        </button>
      )}
      {rows.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-12 text-center">
          <Package className="w-9 h-9 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-foreground font-medium">No resources yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add materials, equipment, labour, fuel and more.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="py-2 px-3 font-medium">Resource</th>
                <th className="py-2 px-3 font-medium">Category</th>
                <th className="py-2 px-3 font-medium text-right">Available</th>
                <th className="py-2 px-3 font-medium text-right">Required</th>
                <th className="py-2 px-3 font-medium text-right">Used / Wasted</th>
                <th className="py-2 px-3 font-medium text-right">Unit cost</th>
                <th className="py-2 px-3 font-medium">Condition</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const short = Number(r.quantity_available) < Number(r.quantity_required);
                return (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 px-3">
                      <div className="font-medium text-foreground">{r.name}</div>
                      {(r.manufacturer || r.supplier_name) && <div className="text-xs text-muted-foreground">{[r.manufacturer, r.supplier_name].filter(Boolean).join(' · ')}</div>}
                    </td>
                    <td className="py-2 px-3"><span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">{r.category.replace(/_/g, ' ')}</span></td>
                    <td className={`py-2 px-3 text-right tabular-nums ${short ? 'text-amber-600 font-medium' : 'text-foreground'}`}>{Number(r.quantity_available)} {r.unit_of_measure || ''}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{Number(r.quantity_required)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{Number(r.quantity_consumed)} / {Number(r.quantity_wasted)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{currency} {Number(r.unit_cost).toLocaleString()}</td>
                    <td className="py-2 px-3">{r.condition ? <span className="text-xs text-muted-foreground">{r.condition}</span> : '—'}</td>
                    <td className="py-2 px-3">
                      {canEdit && (
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setMoveFor(r)} title="Record movement" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><ArrowLeftRight size={14} /></button>
                          <button onClick={() => del(r.id)} title="Delete" className="p-1.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddResourceModal projectId={projectId} currency={currency} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load(); }} toast={toast} />}
      {moveFor && <MovementModal projectId={projectId} resource={moveFor} onClose={() => setMoveFor(null)} onDone={() => { setMoveFor(null); load(); }} toast={toast} />}
    </div>
  );
}

function AddResourceModal({ projectId, currency, onClose, onAdded, toast }) {
  const [f, setF] = useState({ name: '', category: 'material', unit_of_measure: '', quantity_required: '', quantity_available: '', unit_cost: '', condition: 'new', manufacturer: '', grade: '', batch_number: '', expiry_date: '' });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (!f.name.trim()) { toast.error?.('Name is required'); return; }
    setSaving(true);
    try {
      const attributes = {};
      if (f.category === 'material') {
        if (f.grade) attributes.grade = f.grade;
        if (f.batch_number) attributes.batch_number = f.batch_number;
        if (f.expiry_date) attributes.expiry_date = f.expiry_date;
      }
      const res = await fetchWithAuth(`/api/projects/${projectId}/resources`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.name, category: f.category, unit_of_measure: f.unit_of_measure || null,
          quantity_required: Number(f.quantity_required) || 0, quantity_available: Number(f.quantity_available) || 0,
          unit_cost: Number(f.unit_cost) || 0, currency, condition: f.condition || null,
          manufacturer: f.manufacturer || null, attributes,
        }),
      });
      const json = await res.json();
      if (json.success) { toast.success?.('Resource added'); onAdded(); } else toast.error?.(json.error || 'Failed');
    } catch { toast.error?.('Failed'); } finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Add Resource" size="lg"
      footer={<div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted/50">Cancel</button>
        <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-60">{saving ? 'Adding…' : 'Add'}</button>
      </div>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="block text-sm font-medium mb-1">Name *</label><input className={field} value={f.name} onChange={set('name')} autoFocus placeholder="e.g. Cement (Tororo 32.5N)" /></div>
          <div><label className="block text-sm font-medium mb-1">Category</label>
            <select className={field} value={f.category} onChange={set('category')}>{RESOURCE_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}</select></div>
          <div><label className="block text-sm font-medium mb-1">Unit of measure</label><input className={field} value={f.unit_of_measure} onChange={set('unit_of_measure')} placeholder="bags, kg, litres, hrs" /></div>
          <div><label className="block text-sm font-medium mb-1">Qty required</label><input type="number" className={field} value={f.quantity_required} onChange={set('quantity_required')} /></div>
          <div><label className="block text-sm font-medium mb-1">Qty available</label><input type="number" className={field} value={f.quantity_available} onChange={set('quantity_available')} /></div>
          <div><label className="block text-sm font-medium mb-1">Unit cost ({currency})</label><input type="number" className={field} value={f.unit_cost} onChange={set('unit_cost')} /></div>
          <div><label className="block text-sm font-medium mb-1">Condition</label>
            <select className={field} value={f.condition} onChange={set('condition')}>{CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="col-span-2"><label className="block text-sm font-medium mb-1">Manufacturer / brand</label><input className={field} value={f.manufacturer} onChange={set('manufacturer')} /></div>
        </div>
        {f.category === 'material' && (
          <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
            <div className="col-span-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Material intelligence</div>
            <div><label className="block text-sm font-medium mb-1">Grade</label><input className={field} value={f.grade} onChange={set('grade')} placeholder="32.5N" /></div>
            <div><label className="block text-sm font-medium mb-1">Batch no.</label><input className={field} value={f.batch_number} onChange={set('batch_number')} /></div>
            <div><label className="block text-sm font-medium mb-1">Expiry</label><input type="date" className={field} value={f.expiry_date} onChange={set('expiry_date')} /></div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function MovementModal({ projectId, resource, onClose, onDone, toast }) {
  const [type, setType] = useState('receive');
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchWithAuth(`/api/projects/${projectId}/resources/${resource.id}/movements`)
      .then(r => r.json()).then(j => j.success && setHistory(j.data)).catch(() => {});
  }, [projectId, resource.id]);

  const submit = async () => {
    if (!(Number(qty) >= 0) || qty === '') { toast.error?.('Enter a quantity'); return; }
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/resources/${resource.id}/movements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movement_type: type, quantity: Number(qty), notes: notes || null }),
      });
      const json = await res.json();
      if (json.success) { toast.success?.('Movement recorded'); onDone(); } else toast.error?.(json.error || 'Failed');
    } catch { toast.error?.('Failed'); } finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Movement — ${resource.name}`}
      subtitle={`Available: ${Number(resource.quantity_available)} ${resource.unit_of_measure || ''}`}
      footer={<div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted/50">Close</button>
        <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-60">{saving ? 'Saving…' : 'Record'}</button>
      </div>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium mb-1">Type</label>
            <select className={field} value={type} onChange={(e) => setType(e.target.value)}>{MOVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="block text-sm font-medium mb-1">Quantity</label><input type="number" className={field} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></div>
        </div>
        <div><label className="block text-sm font-medium mb-1">Notes</label><input className={field} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <p className="text-xs text-muted-foreground">receive +avail · consume/waste −avail · return +avail · adjust sets available · others are ledger-only.</p>

        {history.length > 0 && (
          <div className="border-t border-border pt-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">History</div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {history.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{m.movement_type}</span>
                  <span className="text-muted-foreground">{Number(m.quantity)} · {new Date(m.moved_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

const PROC_STATUSES = ['requested','approved','ordered','received','inspected','stored','allocated','closed','rejected'];
const PROC_STATUS_STYLE = {
  requested: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  approved: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  ordered: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  received: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  inspected: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  stored: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  allocated: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  closed: 'bg-muted text-muted-foreground', rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

function ProcurementTab({ projectId, canEdit, currency, toast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/procurement`);
      const json = await res.json();
      if (json.success) setRows(json.data);
    } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const money = (v) => `${currency} ${Number(v || 0).toLocaleString()}`;
  if (loading) return <div className="text-sm text-muted-foreground py-8">Loading procurement…</div>;

  return (
    <div className="space-y-4">
      {canEdit && (
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted/50">
          <Plus size={15} /> New Request
        </button>
      )}
      {rows.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-12 text-center">
          <ShoppingCart className="w-9 h-9 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-foreground font-medium">No procurement requests</p>
          <p className="text-sm text-muted-foreground mt-1">Raise a request → approve → order → receive → inspect.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {rows.map((r) => (
            <button key={r.id} onClick={() => setOpenId(r.id)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground truncate">{r.title}</div>
                <div className="text-xs text-muted-foreground">
                  {[r.supplier_name, `${r.line_count} line(s)`, r.needed_by ? `need by ${new Date(r.needed_by).toLocaleDateString()}` : null].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span className="font-medium text-foreground text-sm">{money(r.total_est_cost)}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PROC_STATUS_STYLE[r.status] || 'bg-muted'}`}>{r.status}</span>
            </button>
          ))}
        </div>
      )}

      {showNew && <NewRequestModal projectId={projectId} currency={currency} onClose={() => setShowNew(false)} onDone={() => { setShowNew(false); load(); }} toast={toast} />}
      {openId && <RequestDetailModal projectId={projectId} requestId={openId} canEdit={canEdit} currency={currency} onClose={() => setOpenId(null)} onChanged={load} toast={toast} />}
    </div>
  );
}

function NewRequestModal({ projectId, currency, onClose, onDone, toast }) {
  const [title, setTitle] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [lines, setLines] = useState([{ description: '', quantity: '', unit: '', est_unit_cost: '' }]);
  const [saving, setSaving] = useState(false);
  const setLine = (i, k, v) => setLines(ls => ls.map((l, j) => j === i ? { ...l, [k]: v } : l));
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.est_unit_cost) || 0), 0);

  const submit = async () => {
    if (!title.trim()) { toast.error?.('Title is required'); return; }
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/procurement`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, needed_by: neededBy || null, currency, lines: lines.filter(l => l.description.trim()) }),
      });
      const json = await res.json();
      if (json.success) { toast.success?.('Request created'); onDone(); } else toast.error?.(json.error || 'Failed');
    } catch { toast.error?.('Failed'); } finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="New Procurement Request" size="lg"
      footer={<div className="flex items-center justify-between w-full">
        <span className="text-sm text-muted-foreground">Est. total: <b className="text-foreground">{currency} {total.toLocaleString()}</b></span>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted/50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-60">{saving ? 'Creating…' : 'Create'}</button>
        </div>
      </div>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="block text-sm font-medium mb-1">Title *</label><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="e.g. Cement & rebar for foundation" /></div>
          <div><label className="block text-sm font-medium mb-1">Needed by</label><input type="date" className={field} value={neededBy} onChange={(e) => setNeededBy(e.target.value)} /></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium">Line items</label>
            <button onClick={() => setLines(ls => [...ls, { description: '', quantity: '', unit: '', est_unit_cost: '' }])} className="text-xs text-primary inline-flex items-center gap-1"><Plus size={13} /> Add line</button>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2">
                <input className={`${field} flex-1`} placeholder="Description" value={l.description} onChange={(e) => setLine(i, 'description', e.target.value)} />
                <input type="number" className={`${field} w-20`} placeholder="Qty" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} />
                <input className={`${field} w-20`} placeholder="Unit" value={l.unit} onChange={(e) => setLine(i, 'unit', e.target.value)} />
                <input type="number" className={`${field} w-28`} placeholder="Unit cost" value={l.est_unit_cost} onChange={(e) => setLine(i, 'est_unit_cost', e.target.value)} />
                {lines.length > 1 && <button onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} className="p-2 text-muted-foreground hover:text-red-600"><Trash2 size={14} /></button>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function RequestDetailModal({ projectId, requestId, canEdit, currency, onClose, onChanged, toast }) {
  const [pr, setPr] = useState(null);
  const [rcv, setRcv] = useState({ received_qty: '', rejected_qty: '', inspection_status: 'pending', stored_to_location: '' });
  const money = (v) => `${currency} ${Number(v || 0).toLocaleString()}`;

  const load = useCallback(async () => {
    const res = await fetchWithAuth(`/api/projects/${projectId}/procurement/${requestId}`);
    const json = await res.json();
    if (json.success) setPr(json.data);
  }, [projectId, requestId]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (status) => {
    const res = await fetchWithAuth(`/api/projects/${projectId}/procurement/${requestId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (json.success) { toast.success?.(`Marked ${status}`); load(); onChanged(); } else toast.error?.(json.error || 'Failed');
  };
  const recordReceipt = async () => {
    const res = await fetchWithAuth(`/api/projects/${projectId}/procurement/${requestId}/receipts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ received_qty: Number(rcv.received_qty) || 0, rejected_qty: Number(rcv.rejected_qty) || 0, inspection_status: rcv.inspection_status, stored_to_location: rcv.stored_to_location || null }),
    });
    const json = await res.json();
    if (json.success) { toast.success?.('Receipt recorded'); setRcv({ received_qty: '', rejected_qty: '', inspection_status: 'pending', stored_to_location: '' }); load(); onChanged(); } else toast.error?.(json.error || 'Failed');
  };

  return (
    <Modal isOpen onClose={onClose} title={pr?.title || 'Request'} size="lg"
      subtitle={pr ? `${pr.status} · est. ${money(pr.total_est_cost)}` : ''}>
      {!pr ? <div className="text-sm text-muted-foreground py-6">Loading…</div> : (
        <div className="space-y-4">
          {canEdit && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Set status:</span>
              <select className={`${field} w-auto`} value={pr.status} onChange={(e) => setStatus(e.target.value)}>
                {PROC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {pr.status === 'approved' && <span className="text-xs text-emerald-600">→ commitment created (feeds budget)</span>}
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Line items</div>
            <div className="border border-border rounded-lg divide-y divide-border">
              {pr.lines.length === 0 ? <div className="p-3 text-sm text-muted-foreground">No lines.</div> : pr.lines.map((l) => (
                <div key={l.id} className="flex items-center gap-2 p-2 text-sm">
                  <span className="flex-1 text-foreground">{l.description}</span>
                  <span className="text-muted-foreground">{Number(l.quantity)} {l.unit}</span>
                  <span className="text-foreground">{money(Number(l.quantity) * Number(l.est_unit_cost))}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Goods receipts</div>
            {pr.receipts.length === 0 ? <div className="text-sm text-muted-foreground">None yet.</div> : (
              <div className="space-y-1">
                {pr.receipts.map((g) => (
                  <div key={g.id} className="flex items-center gap-2 text-sm">
                    <span className="text-foreground">recv {Number(g.received_qty)}</span>
                    {Number(g.rejected_qty) > 0 && <span className="text-red-600">rej {Number(g.rejected_qty)}</span>}
                    <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">{g.inspection_status}</span>
                    <span className="text-muted-foreground ml-auto">{new Date(g.received_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {canEdit && pr.status !== 'closed' && pr.status !== 'rejected' && (
            <div className="border-t border-border pt-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Record goods receipt</div>
              <div className="flex flex-wrap items-end gap-2">
                <div><label className="block text-xs text-muted-foreground mb-1">Received</label><input type="number" className={`${field} w-24`} value={rcv.received_qty} onChange={(e) => setRcv(s => ({ ...s, received_qty: e.target.value }))} /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">Rejected</label><input type="number" className={`${field} w-24`} value={rcv.rejected_qty} onChange={(e) => setRcv(s => ({ ...s, rejected_qty: e.target.value }))} /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">Inspection</label>
                  <select className={`${field} w-32`} value={rcv.inspection_status} onChange={(e) => setRcv(s => ({ ...s, inspection_status: e.target.value }))}>
                    {['pending','passed','failed','conditional'].map(x => <option key={x} value={x}>{x}</option>)}
                  </select></div>
                <button onClick={recordReceipt} className="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium">Record</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function TeamTab({ project, users, canManageMembers, projectId, onChanged, toast }) {
  const ROLES = ['governor','manager','stage_leader','contributor','viewer','contractor','client','accountant','procurement_officer','storekeeper','inspector','field_worker'];
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('contributor');
  const members = project.members || [];

  const add = async () => {
    if (!userId) { toast.error?.('Select a user'); return; }
    const res = await fetchWithAuth(`/api/projects/${projectId}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, project_role: role }),
    });
    const json = await res.json();
    if (json.success) { toast.success?.('Member added'); setUserId(''); onChanged(); } else toast.error?.(json.error || 'Failed');
  };
  const remove = async (memberId) => {
    const res = await fetchWithAuth(`/api/projects/${projectId}/members?memberId=${memberId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) onChanged(); else toast.error?.(json.error || 'Failed');
  };

  return (
    <div className="space-y-4">
      {canManageMembers && (
        <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium mb-1 text-muted-foreground">User</label>
            <select className={field} value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">— Select user —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium mb-1 text-muted-foreground">Project role</label>
            <select className={field} value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
          <button onClick={add} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Plus size={15} /> Add</button>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {members.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">No members yet.</div>
        ) : members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
              {(m.user_name || m.user_email || '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground truncate">{m.user_name || m.user_email}</div>
              <div className="text-xs text-muted-foreground truncate">{m.user_email}</div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">{m.project_role.replace('_', ' ')}</span>
            {canManageMembers && (
              <button onClick={() => remove(m.id)} className="p-1.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600"><Trash2 size={15} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
