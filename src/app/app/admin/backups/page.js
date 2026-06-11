'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Database, Plus, Trash2, Download, RotateCcw, ShieldCheck, Eye, AlertTriangle,
  CheckCircle2, Loader2, RefreshCw, X, Server, Calendar,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';

const STATUS_BADGE = {
  completed:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  uploaded:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  failed:      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  approved:    'bg-emerald-100 text-emerald-700',
  pending:     'bg-yellow-100 text-yellow-700',
  rejected:    'bg-red-100 text-red-700',
  running:     'bg-blue-100 text-blue-700',
};

const VERIFY_BADGE = {
  verified:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  pending:   'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  failed:    'bg-red-100 text-red-700',
  corrupted: 'bg-red-200 text-red-800',
};

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminBackupsPage() {
  const [backups, setBackups]           = useState([]);
  const [stats, setStats]               = useState(null);
  const [restorations, setRestorations] = useState([]);
  const [targets, setTargets]           = useState([]);
  const [jobs, setJobs]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState('backups');
  const toast = useToast();

  // Create-backup form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating]     = useState(false);
  const [form, setForm] = useState({ name: '', description: '', backup_type: 'full', encrypt: false, compress: true, retention_days: 30 });

  // Per-action busy
  const [busyId, setBusyId] = useState(null);

  // Restore preview modal
  const [previewModal, setPreviewModal] = useState(null); // { backup, summary }
  const [restoreAck, setRestoreAck]     = useState(false);

  // Target/job forms
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [showJobForm, setShowJobForm]       = useState(false);
  const [targetForm, setTargetForm] = useState({ name: '', type: 'cloudinary', config_text: '{}', is_primary: false });
  const [jobForm, setJobForm] = useState({ name: '', backup_type: 'full', schedule_cron: '', encrypt: false, compress: true, retention_days: 30 });

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [b, r, t, j] = await Promise.all([
        fetch('/api/backups', { credentials: 'include' }).then(x => x.json()),
        fetch('/api/backups/restore', { credentials: 'include' }).then(x => x.json()).catch(() => ({})),
        fetch('/api/backups/storage-targets', { credentials: 'include' }).then(x => x.json()).catch(() => ({})),
        fetch('/api/backups/jobs', { credentials: 'include' }).then(x => x.json()).catch(() => ({})),
      ]);
      if (b.success) { setBackups(b.data || []); setStats(b.stats || null); }
      if (r.success) setRestorations(r.data || []);
      if (t.success) setTargets(t.data || []);
      if (j.success) setJobs(j.data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const createBackup = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/backups', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          description: form.description.trim() || undefined,
          backup_type: form.backup_type,
          encrypt: form.encrypt,
          compress: form.compress,
          retention_days: parseInt(form.retention_days, 10) || 30,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Backup created — ${data.data.tables} tables, ${data.data.rows?.toLocaleString()} rows`);
        setShowCreate(false);
        setForm({ name: '', description: '', backup_type: 'full', encrypt: false, compress: true, retention_days: 30 });
        refreshAll();
      } else { toast.error(data.error || 'Failed'); }
    } catch (e) { toast.error('Network error'); }
    finally { setCreating(false); }
  };

  const deleteBackup = async (b) => {
    if (!await confirmDelete(`Delete backup "${b.name}"?`)) return;
    setBusyId(b.id);
    try {
      const r = await fetch(`/api/backups?id=${b.id}`, { method: 'DELETE', credentials: 'include' }).then(x => x.json());
      if (r.success) { toast.success('Deleted'); refreshAll(); } else toast.error(r.error || 'Failed');
    } finally { setBusyId(null); }
  };

  const verifyBackup = async (b) => {
    setBusyId(b.id);
    try {
      const r = await fetch(`/api/backups/${b.id}/verify`, { method: 'POST', credentials: 'include' }).then(x => x.json());
      if (r.success) { toast.success(r.verified ? 'Checksum verified' : 'CHECKSUM MISMATCH — backup corrupted'); refreshAll(); }
      else toast.error(r.error || 'Verify failed');
    } finally { setBusyId(null); }
  };

  const previewRestore = async (b) => {
    setBusyId(b.id);
    try {
      const r = await fetch(`/api/backups/${b.id}/preview`, { credentials: 'include' }).then(x => x.json());
      if (r.success) { setPreviewModal({ backup: b, summary: r.preview }); setRestoreAck(false); }
      else toast.error(r.error || 'Preview failed');
    } finally { setBusyId(null); }
  };

  const runRestore = async () => {
    if (!previewModal || !restoreAck) return;
    setBusyId(previewModal.backup.id);
    try {
      const r = await fetch('/api/backups/restore', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup_id: previewModal.backup.id, preview: false, approved: true }),
      }).then(x => x.json());
      if (r.success) {
        toast.success(`Restore completed — ${r.executed_statements} statements applied (${r.failed_statements} failed)`);
        setPreviewModal(null); refreshAll();
      } else toast.error(r.error || 'Restore failed');
    } finally { setBusyId(null); }
  };

  const createTarget = async () => {
    let config;
    try { config = JSON.parse(targetForm.config_text || '{}'); }
    catch { toast.error('Config must be valid JSON'); return; }
    const r = await fetch('/api/backups/storage-targets', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: targetForm.name, type: targetForm.type, config, is_primary: targetForm.is_primary }),
    }).then(x => x.json());
    if (r.success) {
      toast.success('Target added'); setShowTargetForm(false);
      setTargetForm({ name: '', type: 'cloudinary', config_text: '{}', is_primary: false });
      refreshAll();
    } else toast.error(r.error || 'Failed');
  };

  const createJob = async () => {
    const r = await fetch('/api/backups/jobs', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...jobForm, retention_days: parseInt(jobForm.retention_days, 10) || 30 }),
    }).then(x => x.json());
    if (r.success) {
      toast.success('Schedule created'); setShowJobForm(false);
      setJobForm({ name: '', backup_type: 'full', schedule_cron: '', encrypt: false, compress: true, retention_days: 30 });
      refreshAll();
    } else toast.error(r.error || 'Failed');
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading backups…</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">System Backups</h1>
            <p className="text-sm text-muted-foreground">Encrypted, checksummed, restore-previewed.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={refreshAll} className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted inline-flex items-center gap-1.5 cursor-pointer">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-4 h-4" /> Create Backup
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Total"       value={stats.total} />
          <Stat label="Completed"   value={stats.completed} color="text-emerald-600" />
          <Stat label="Failed"      value={stats.failed}    color="text-red-600" />
          <Stat label="Verified"    value={stats.verified}  color="text-blue-600" />
          <Stat label="Total Size"  value={formatBytes(stats.total_bytes)} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          ['backups', 'Backups'],
          ['restorations', 'Restorations'],
          ['targets', 'Storage Targets'],
          ['jobs', 'Schedules'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 cursor-pointer ${tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Backups tab */}
      {tab === 'backups' && (
        backups.length === 0 ? (
          <Empty text="No backups yet. Create your first backup to begin." />
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/30">
                  <Th>Name</Th><Th>Type</Th><Th>Status</Th><Th>Verify</Th>
                  <Th>Size</Th><Th>Tables</Th><Th>Rows</Th><Th>Created</Th><Th></Th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {backups.map(b => (
                    <tr key={b.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-foreground font-medium">
                        {b.name}
                        {b.encrypted && <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">enc</span>}
                        {b.compression && <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{b.compression}</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{b.backup_type}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[b.status] || 'bg-muted'}`}>{b.status}</span></td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${VERIFY_BADGE[b.verification_status] || 'bg-muted'}`}>{b.verification_status || 'unverified'}</span></td>
                      <td className="px-4 py-3 text-muted-foreground">{formatBytes(b.file_size)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.table_count}</td>
                      <td className="px-4 py-3 text-muted-foreground">{(b.row_count || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(b.created_at)}</td>
                      <td className="px-4 py-3 flex items-center gap-1.5">
                        {b.file_url && (
                          <>
                            <a href={b.file_url} target="_blank" rel="noopener noreferrer"
                               title="Download" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Download className="w-4 h-4" /></a>
                            <button title="Verify" disabled={busyId === b.id} onClick={() => verifyBackup(b)}
                                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50 cursor-pointer">
                              {busyId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                            </button>
                            <button title="Preview Restore" disabled={busyId === b.id} onClick={() => previewRestore(b)}
                                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50 cursor-pointer">
                              <Eye className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button title="Delete" disabled={busyId === b.id} onClick={() => deleteBackup(b)}
                                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 disabled:opacity-50 cursor-pointer dark:bg-red-900/30 dark:text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Restorations tab */}
      {tab === 'restorations' && (
        restorations.length === 0 ? (
          <Empty text="No restoration history." />
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <SimpleTable
              headers={['Backup', 'Status', 'Scope', 'Tables', 'Rows', 'Requested', 'Approved', 'When']}
              rows={restorations.map(r => [
                r.backup_name,
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status] || 'bg-muted'}`}>{r.status}</span>,
                r.scope, r.tables_affected ?? '—', r.rows_affected?.toLocaleString() ?? '—',
                r.requested_by_name || '—', r.approved_by_name || '—',
                formatDate(r.created_at),
              ])}
            />
          </div>
        )
      )}

      {/* Storage targets tab */}
      {tab === 'targets' && (
        <div className="space-y-3">
          <button onClick={() => setShowTargetForm(true)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-4 h-4" /> Add Target
          </button>
          {targets.length === 0 ? (
            <Empty text="No storage targets configured. Backups fall back to Cloudinary if available." />
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <SimpleTable
                headers={['Name', 'Type', 'Active', 'Primary', 'Created']}
                rows={targets.map(t => [
                  <span key="n" className="font-medium">{t.name}</span>,
                  <span key="t" className="capitalize">{t.type}</span>,
                  t.is_active ? 'yes' : 'no',
                  t.is_primary ? <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">primary</span> : '—',
                  formatDate(t.created_at),
                ])}
              />
            </div>
          )}
        </div>
      )}

      {/* Jobs tab */}
      {tab === 'jobs' && (
        <div className="space-y-3">
          <button onClick={() => setShowJobForm(true)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-4 h-4" /> Add Schedule
          </button>
          {jobs.length === 0 ? (
            <Empty text="No scheduled jobs. Use cron expressions for recurring backups." />
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <SimpleTable
                headers={['Name', 'Type', 'Cron', 'Encrypt', 'Compress', 'Retention', 'Last Run', 'Active']}
                rows={jobs.map(j => [
                  <span key="n" className="font-medium">{j.name}</span>,
                  <span key="t" className="capitalize">{j.backup_type}</span>,
                  <code key="c" className="text-xs">{j.schedule_cron || '—'}</code>,
                  j.encrypt ? 'yes' : 'no',
                  j.compress ? 'yes' : 'no',
                  `${j.retention_days}d`,
                  j.last_run_at ? formatDate(j.last_run_at) : '—',
                  j.is_active ? 'yes' : 'no',
                ])}
              />
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal title="Create Backup" onClose={() => setShowCreate(false)} onConfirm={createBackup} confirmLabel="Create" busy={creating}>
          <Input label="Name" value={form.name} onChange={v => setForm(s => ({ ...s, name: v }))} placeholder="(auto-generated if blank)" />
          <Input label="Description" value={form.description} onChange={v => setForm(s => ({ ...s, description: v }))} />
          <Select label="Type" value={form.backup_type} onChange={v => setForm(s => ({ ...s, backup_type: v }))}
            options={[['full', 'Full'], ['schema_only', 'Schema only'], ['data_only', 'Data only'], ['incremental', 'Incremental']]} />
          <Input label="Retention (days)" type="number" value={form.retention_days} onChange={v => setForm(s => ({ ...s, retention_days: v }))} />
          <Check label="Compress (gzip)" value={form.compress} onChange={v => setForm(s => ({ ...s, compress: v }))} />
          <Check label="Encrypt (AES-256-GCM, requires BACKUP_ENCRYPTION_KEY env var)" value={form.encrypt} onChange={v => setForm(s => ({ ...s, encrypt: v }))} />
        </Modal>
      )}

      {/* Preview restore modal */}
      {previewModal && (
        <Modal title={`Restore from "${previewModal.backup.name}"`} onClose={() => setPreviewModal(null)}
          confirmLabel="Run Restore" tone="red" busy={busyId === previewModal.backup.id}
          onConfirm={runRestore} confirmDisabled={!restoreAck}
          warning="Restore will execute the backup's INSERT statements with ON CONFLICT DO NOTHING. Existing rows are kept; missing rows are inserted. Do not run against production without an offline copy.">
          <div className="text-sm space-y-2">
            <div><strong>{previewModal.summary.tables_in_backup}</strong> tables · <strong>{previewModal.summary.rows_in_backup.toLocaleString()}</strong> rows in backup</div>
            <div className="max-h-60 overflow-y-auto border border-border rounded">
              <table className="w-full text-xs">
                <thead><tr className="bg-muted/30"><th className="text-left px-2 py-1">Table</th><th className="text-left px-2 py-1">Incoming</th><th className="text-left px-2 py-1">Current</th></tr></thead>
                <tbody>
                  {previewModal.summary.per_table.map(t => (
                    <tr key={t.table} className="border-t border-border">
                      <td className="px-2 py-1 font-mono">{t.table}</td>
                      <td className="px-2 py-1">{t.incoming_rows.toLocaleString()}</td>
                      <td className="px-2 py-1">{t.table_exists ? t.current_rows.toLocaleString() : <span className="text-amber-600">missing table</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="flex items-start gap-2 mt-3 text-sm">
              <input type="checkbox" checked={restoreAck} onChange={e => setRestoreAck(e.target.checked)} className="mt-1" />
              <span>I understand this will modify the database and have a current backup or offline copy.</span>
            </label>
          </div>
        </Modal>
      )}

      {/* Storage target form */}
      {showTargetForm && (
        <Modal title="Add Storage Target" onClose={() => setShowTargetForm(false)} onConfirm={createTarget} confirmLabel="Add">
          <Input label="Name *" value={targetForm.name} onChange={v => setTargetForm(s => ({ ...s, name: v }))} />
          <Select label="Type" value={targetForm.type} onChange={v => setTargetForm(s => ({ ...s, type: v }))}
            options={[['cloudinary', 'Cloudinary'], ['s3', 'S3'], ['local', 'Local disk'], ['custom', 'Custom']]} />
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Config (JSON)</label>
            <textarea value={targetForm.config_text} onChange={e => setTargetForm(s => ({ ...s, config_text: e.target.value }))}
              rows={4} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <Check label="Set as primary" value={targetForm.is_primary} onChange={v => setTargetForm(s => ({ ...s, is_primary: v }))} />
        </Modal>
      )}

      {/* Job form */}
      {showJobForm && (
        <Modal title="Schedule Backup" onClose={() => setShowJobForm(false)} onConfirm={createJob} confirmLabel="Create">
          <Input label="Name *" value={jobForm.name} onChange={v => setJobForm(s => ({ ...s, name: v }))} />
          <Select label="Type" value={jobForm.backup_type} onChange={v => setJobForm(s => ({ ...s, backup_type: v }))}
            options={[['full', 'Full'], ['schema_only', 'Schema only'], ['data_only', 'Data only'], ['incremental', 'Incremental']]} />
          <Input label="Cron expression" value={jobForm.schedule_cron} onChange={v => setJobForm(s => ({ ...s, schedule_cron: v }))} placeholder="0 2 * * *" />
          <Input label="Retention (days)" type="number" value={jobForm.retention_days} onChange={v => setJobForm(s => ({ ...s, retention_days: v }))} />
          <Check label="Compress (gzip)" value={jobForm.compress} onChange={v => setJobForm(s => ({ ...s, compress: v }))} />
          <Check label="Encrypt" value={jobForm.encrypt} onChange={v => setJobForm(s => ({ ...s, encrypt: v }))} />
        </Modal>
      )}
    </div>
  );
}

const Th = ({ children }) => <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{children}</th>;
function Stat({ label, value, color = 'text-foreground' }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value ?? 0}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
function Empty({ text }) { return <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">{text}</div>; }
function SimpleTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-muted/30">{headers.map(h => <Th key={h}>{h}</Th>)}</tr></thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-4 py-3 text-foreground">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

const TONE = { red: 'bg-red-600 hover:bg-red-700', blue: 'bg-blue-600 hover:bg-blue-700' };
const inputCls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

function Input({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </div>
  );
}
function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={`${inputCls} [&>option]:bg-background`}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
function Check({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />
      <span className="text-foreground">{label}</span>
    </label>
  );
}
function Modal({ title, children, onClose, onConfirm, confirmLabel, tone = 'blue', busy, warning, confirmDisabled }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-lg">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        {warning && (
          <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {warning}
          </div>
        )}
        <div className="space-y-3">{children}</div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted cursor-pointer">Cancel</button>
          {onConfirm && (
            <button onClick={onConfirm} disabled={busy || confirmDisabled}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${TONE[tone]} disabled:opacity-50 cursor-pointer`}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
