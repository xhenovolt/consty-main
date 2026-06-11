'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, FileText, History, MessageSquare, Shield, CheckCircle2,
  Link as LinkIcon, X, Loader2, Send, Edit3, Trash2,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const STATUS_BADGE = {
  draft:     'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_review: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  archived:  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const fmtDateTime = d => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function DocumentDetailPage({ params }) {
  const { id } = use(params);
  const toast = useToast();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [tab, setTab]         = useState('content');
  const [editMode, setEditMode] = useState(false);
  const [bodyEdit, setBodyEdit] = useState('');
  const [titleEdit, setTitleEdit] = useState('');
  const [saving, setSaving] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approverIds, setApproverIds] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkForm, setLinkForm] = useState({ entity_type: 'system', entity_id: '' });
  const [showACLModal, setShowACLModal] = useState(false);
  const [aclForm, setAclForm] = useState({ principal_type: 'user', principal_id: '', permission: 'view' });

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetchWithAuth(`/api/documents/${id}`).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Not found');
      setData(r);
      setTitleEdit(r.document.title);
      setBodyEdit(r.document.body || '');
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetchWithAuth(`/api/documents/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleEdit, body: bodyEdit, changelog: 'edit' }),
      }).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Failed');
      toast.success('Saved');
      setEditMode(false); load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const rollback = async (v) => {
    if (!confirm(`Roll back to v${v.version}?`)) return;
    try {
      const r = await fetchWithAuth(`/api/documents/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: v.title, body: v.body, changelog: `rollback to v${v.version}` }),
      }).then(x => x.json());
      if (r.success) { toast.success(`Rolled back`); load(); } else toast.error(r.error || 'Failed');
    } catch (e) { toast.error(e.message); }
  };

  const addComment = async () => {
    if (!commentBody.trim()) return;
    const r = await fetchWithAuth(`/api/documents/${id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: commentBody }),
    }).then(x => x.json());
    if (r.success) { setCommentBody(''); toast.success('Posted'); load(); } else toast.error(r.error || 'Failed');
  };

  const resolveComment = async (cid, resolved) => {
    const r = await fetchWithAuth(`/api/documents/${id}/comments`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_id: cid, resolved }),
    }).then(x => x.json());
    if (r.success) load(); else toast.error(r.error || 'Failed');
  };

  const submitForReview = async () => {
    const ids = approverIds.split(',').map(s => s.trim()).filter(Boolean);
    if (!ids.length) { toast.error('Add at least one approver UUID'); return; }
    const r = await fetchWithAuth(`/api/documents/${id}/approvals`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approver_ids: ids }),
    }).then(x => x.json());
    if (r.success) { setShowApprovalModal(false); setApproverIds(''); toast.success('Sent for review'); load(); }
    else toast.error(r.error || 'Failed');
  };

  const decideApproval = async (approval_id, status) => {
    const comment = status === 'rejected' ? prompt('Rejection reason:') || '' : '';
    const r = await fetchWithAuth(`/api/documents/${id}/approvals`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approval_id, status, comment }),
    }).then(x => x.json());
    if (r.success) { toast.success(status); load(); } else toast.error(r.error || 'Failed');
  };

  const addLink = async () => {
    if (!linkForm.entity_id) { toast.error('entity_id required'); return; }
    const r = await fetchWithAuth(`/api/documents/${id}/links`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(linkForm),
    }).then(x => x.json());
    if (r.success) { setShowLinkModal(false); setLinkForm({ entity_type: 'system', entity_id: '' }); load(); }
    else toast.error(r.error || 'Failed');
  };

  const removeLink = async (link_id) => {
    const r = await fetchWithAuth(`/api/documents/${id}/links?link_id=${link_id}`, {
      method: 'DELETE',
    }).then(x => x.json());
    if (r.success) load();
  };

  const addACL = async () => {
    if (!aclForm.principal_id) { toast.error('principal_id required'); return; }
    const r = await fetchWithAuth(`/api/documents/${id}/permissions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aclForm),
    }).then(x => x.json());
    if (r.success) { setShowACLModal(false); setAclForm({ principal_type: 'user', principal_id: '', permission: 'view' }); load(); }
    else toast.error(r.error || 'Failed');
  };

  const removeACL = async (grant_id) => {
    const r = await fetchWithAuth(`/api/documents/${id}/permissions?grant_id=${grant_id}`, {
      method: 'DELETE',
    }).then(x => x.json());
    if (r.success) load();
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading document…</div>;
  if (error || !data) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Link href="/app/documents" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-xl p-6 text-center">{error || 'Document not found'}</div>
      </div>
    );
  }

  const d = data.document;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href="/app/documents" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-foreground">{d.title}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[d.approval_status] || 'bg-muted'}`}>{d.approval_status}</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">v{d.current_version}</span>
              {d.visibility && <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 capitalize">{d.visibility}</span>}
            </div>
            {d.description && <p className="text-sm text-muted-foreground mt-1">{d.description}</p>}
            <div className="text-xs text-muted-foreground mt-2">
              {d.uploaded_by_name || '—'} · {fmtDateTime(d.created_at)}
              {d.folder_name && <> · 📁 {d.folder_name}</>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!editMode && (
            <button onClick={() => setEditMode(true)} className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted inline-flex items-center gap-1.5 cursor-pointer">
              <Edit3 className="w-4 h-4" /> Edit
            </button>
          )}
          {d.approval_status === 'draft' && (
            <button onClick={() => setShowApprovalModal(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 inline-flex items-center gap-1.5 cursor-pointer">
              <Send className="w-4 h-4" /> Send for Review
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {[
          ['content',     `Content`],
          ['versions',    `History (${data.versions.length})`],
          ['comments',    `Comments (${data.comments.length})`],
          ['approvals',   `Approvals (${data.approvals.length})`],
          ['permissions', `ACLs (${data.permissions.length})`],
          ['links',       `Links (${data.links.length})`],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 cursor-pointer whitespace-nowrap ${tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'content' && (
        <div className="bg-card border border-border rounded-xl p-5">
          {editMode ? (
            <div className="space-y-3">
              <input value={titleEdit} onChange={e => setTitleEdit(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-base font-medium" />
              <textarea value={bodyEdit} onChange={e => setBodyEdit(e.target.value)} rows={20}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setEditMode(false); setBodyEdit(d.body || ''); setTitleEdit(d.title); }}
                  className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted cursor-pointer">Cancel</button>
                <button onClick={save} disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 cursor-pointer">
                  {saving ? 'Saving…' : 'Save (creates new version)'}
                </button>
              </div>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-sm text-foreground font-mono leading-relaxed">{d.body || <span className="text-muted-foreground italic">No body content.</span>}</pre>
          )}
          {d.file_url && (
            <div className="mt-4 pt-4 border-t border-border">
              <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                📎 {d.file_name || 'Attached file'}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Versions */}
      {tab === 'versions' && (
        <Section title="Version History">
          {data.versions.length === 0 ? <Empty text="No versions." /> : (
            <ul className="space-y-2">
              {data.versions.map(v => (
                <li key={v.id} className="flex items-start gap-3 text-sm border-b border-border pb-2 last:border-0">
                  <span className="font-medium w-12">v{v.version}</span>
                  {v.is_current && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">current</span>}
                  <span className="text-muted-foreground flex-1">{v.title} {v.changelog && `· ${v.changelog}`}</span>
                  <span className="text-xs text-muted-foreground">{fmtDateTime(v.created_at)}</span>
                  {!v.is_current && (
                    <button onClick={() => rollback(v)} className="text-xs text-primary hover:underline cursor-pointer">Roll back</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* Comments */}
      {tab === 'comments' && (
        <Section title="Comments">
          <div className="flex gap-2 mb-3">
            <input value={commentBody} onChange={e => setCommentBody(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={e => e.key === 'Enter' && addComment()} />
            <button onClick={addComment} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer">Post</button>
          </div>
          {data.comments.length === 0 ? <Empty text="No comments." /> : (
            <ul className="space-y-2">
              {data.comments.map(c => (
                <li key={c.id} className="border border-border rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground">{c.author_name || '—'}</span>
                    <span className="text-xs text-muted-foreground">{fmtDateTime(c.created_at)}</span>
                  </div>
                  <p className={c.resolved ? 'text-muted-foreground line-through' : 'text-foreground'}>{c.body}</p>
                  <button onClick={() => resolveComment(c.id, !c.resolved)}
                    className="mt-2 text-xs text-primary hover:underline cursor-pointer">
                    {c.resolved ? 'Reopen' : 'Resolve'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* Approvals ladder */}
      {tab === 'approvals' && (
        <Section title="Approval Workflow">
          {data.approvals.length === 0 ? <Empty text="No approval workflow active." /> : (
            <ol className="space-y-2">
              {data.approvals.map(a => (
                <li key={a.id} className="flex items-center gap-3 text-sm border-b border-border pb-2 last:border-0">
                  <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-medium">{a.step_order}</span>
                  <span className="flex-1">{a.approver_name || a.approver_id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    a.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    a.status === 'pending'  ? 'bg-yellow-100 text-yellow-700' :
                    'bg-slate-100 text-slate-700'
                  } dark:bg-red-900/30 dark:text-red-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:bg-yellow-900/30 dark:text-yellow-300`}>{a.status}</span>
                  {a.status === 'pending' && (
                    <div className="flex gap-1">
                      <button onClick={() => decideApproval(a.id, 'approved')} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs cursor-pointer">Approve</button>
                      <button onClick={() => decideApproval(a.id, 'rejected')} className="px-2 py-1 bg-red-600 text-white rounded text-xs cursor-pointer">Reject</button>
                    </div>
                  )}
                  {a.decision_at && <span className="text-xs text-muted-foreground">{fmtDateTime(a.decision_at)}</span>}
                </li>
              ))}
            </ol>
          )}
        </Section>
      )}

      {/* Permissions */}
      {tab === 'permissions' && (
        <Section title="Access Control" right={
          <button onClick={() => setShowACLModal(true)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs cursor-pointer">+ Grant</button>
        }>
          {data.permissions.length === 0 ? <Empty text="No explicit ACLs (RBAC permissions still apply)." /> : (
            <ul className="space-y-1.5">
              {data.permissions.map(p => (
                <li key={p.id} className="flex items-center justify-between text-sm border-b border-border py-1.5 last:border-0">
                  <span><strong className="capitalize">{p.principal_type}</strong> <code className="text-xs">{p.principal_id}</code></span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 capitalize">{p.permission}</span>
                  <button onClick={() => removeACL(p.id)} className="text-red-500 hover:bg-red-50 p-1 rounded cursor-pointer dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* Links */}
      {tab === 'links' && (
        <Section title="Linked Entities" right={
          <button onClick={() => setShowLinkModal(true)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs cursor-pointer">+ Link</button>
        }>
          {data.links.length === 0 ? <Empty text="Not linked to anything." /> : (
            <ul className="space-y-1.5">
              {data.links.map(l => (
                <li key={l.id} className="flex items-center justify-between text-sm border-b border-border py-1.5 last:border-0">
                  <span><strong className="capitalize">{l.entity_type}</strong> <code className="text-xs">{l.entity_id}</code></span>
                  <span className="text-xs text-muted-foreground">{l.relationship}</span>
                  <button onClick={() => removeLink(l.id)} className="text-red-500 hover:bg-red-50 p-1 rounded cursor-pointer dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* Modals */}
      {showApprovalModal && (
        <Modal title="Send for Review" onClose={() => setShowApprovalModal(false)} onConfirm={submitForReview} confirmLabel="Send">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Approver UUIDs (comma separated)</label>
            <input value={approverIds} onChange={e => setApproverIds(e.target.value)}
              placeholder="uuid1, uuid2"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </Modal>
      )}
      {showLinkModal && (
        <Modal title="Link Entity" onClose={() => setShowLinkModal(false)} onConfirm={addLink} confirmLabel="Link">
          <Select label="Entity type" value={linkForm.entity_type} onChange={v => setLinkForm(s => ({ ...s, entity_type: v }))}
            options={['system','department','staff','client','deal','subscription','invoice','issue','proposal','license','backup'].map(x => [x, x])} />
          <Input label="Entity ID *" value={linkForm.entity_id} onChange={v => setLinkForm(s => ({ ...s, entity_id: v }))} placeholder="uuid" />
        </Modal>
      )}
      {showACLModal && (
        <Modal title="Grant Access" onClose={() => setShowACLModal(false)} onConfirm={addACL} confirmLabel="Grant">
          <Select label="Principal type" value={aclForm.principal_type} onChange={v => setAclForm(s => ({ ...s, principal_type: v }))}
            options={[['user', 'User'], ['department', 'Department'], ['role', 'Role']]} />
          <Input label="Principal ID *" value={aclForm.principal_id} onChange={v => setAclForm(s => ({ ...s, principal_id: v }))} placeholder="uuid" />
          <Select label="Permission" value={aclForm.permission} onChange={v => setAclForm(s => ({ ...s, permission: v }))}
            options={[['view', 'View'], ['comment', 'Comment'], ['edit', 'Edit'], ['admin', 'Admin']]} />
        </Modal>
      )}
    </div>
  );
}

function Section({ title, children, right }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-foreground">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}
function Empty({ text }) { return <div className="text-sm text-muted-foreground text-center py-4">{text}</div>; }

const inputCls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';
const Input = ({ label, value, onChange, placeholder }) => (
  <div><label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} /></div>
);
const Select = ({ label, value, onChange, options }) => (
  <div><label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} className={`${inputCls} [&>option]:bg-background`}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select></div>
);
function Modal({ title, children, onClose, onConfirm, confirmLabel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-lg">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">{children}</div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted cursor-pointer">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 cursor-pointer">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
