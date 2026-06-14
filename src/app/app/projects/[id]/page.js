'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Trash2, Users, ListTree, LayoutDashboard, ShieldCheck,
  CalendarDays, Wallet,
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
          {[['overview', 'Overview', LayoutDashboard], ['work', 'Work', ListTree], ['team', 'Team', Users]].map(([key, label, Icon]) => (
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
