'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import {
  ArrowLeft, Key, Shield, Pause, Play, Ban, RefreshCw, Send, Copy, Check,
  Smartphone, Globe, Activity, Calendar, AlertTriangle,
} from 'lucide-react';

const STATUS_COLOR = {
  pending:     'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  trial:       'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  active:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  suspended:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  expired:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  revoked:     'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  transferred: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function LicenseDetailPage({ params }) {
  const { id } = use(params);
  const toast = useToast();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [busy, setBusy]       = useState(false);
  const [copied, setCopied]   = useState(false);

  // Modal state for actions that need a reason / inputs
  const [modal, setModal] = useState(null); // 'suspend' | 'revoke' | 'renew' | 'transfer' | null
  const [modalInput, setModalInput] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetchWithAuth(`/api/licenses/${id}`).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Failed to load');
      setData(r);
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const act = async (path, body) => {
    setBusy(true);
    try {
      const r = await fetchWithAuth(`/api/licenses/${id}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      }).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Action failed');
      toast.success(`License ${path} successful`);
      setModal(null); setModalInput({});
      load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const copyKey = () => {
    if (!data?.license?.license_key) return;
    navigator.clipboard.writeText(data.license.license_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading license…</div>;
  if (error || !data) return <div className="p-6 text-destructive">Error: {error || 'License not found'}</div>;

  const l = data.license;
  const status = l.status;
  const canActivate = ['pending', 'trial'].includes(status);
  const canSuspend  = status === 'active';
  const canResume   = status === 'suspended';
  const canRevoke   = !['revoked'].includes(status);
  const canRenew    = !['revoked'].includes(status);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Link href="/app/licenses" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to licenses
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Key className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{l.client_name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[status] || 'bg-muted'}`}>{status}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {l.system_name || '—'} · {l.plan_name || 'No plan'} · {l.license_type}
            </p>
            <div className="mt-2 flex items-center gap-2 font-mono text-xs">
              <span className="text-foreground">{l.license_key || '—'}</span>
              {l.license_key && (
                <button onClick={copyKey} className="text-muted-foreground hover:text-foreground" title="Copy key">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canActivate && (
            <button onClick={() => act('activate', {})} disabled={busy}
              className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer">
              <Shield className="w-4 h-4" /> Activate
            </button>
          )}
          {canSuspend && (
            <button onClick={() => setModal('suspend')} disabled={busy}
              className="px-3 py-1.5 text-sm rounded-lg bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer">
              <Pause className="w-4 h-4" /> Suspend
            </button>
          )}
          {canResume && (
            <button onClick={() => act('resume', {})} disabled={busy}
              className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer">
              <Play className="w-4 h-4" /> Resume
            </button>
          )}
          {canRenew && (
            <button onClick={() => setModal('renew')} disabled={busy}
              className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer">
              <RefreshCw className="w-4 h-4" /> Renew
            </button>
          )}
          <button onClick={() => setModal('transfer')} disabled={busy}
            className="px-3 py-1.5 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer">
            <Send className="w-4 h-4" /> Transfer
          </button>
          {canRevoke && (
            <button onClick={() => setModal('revoke')} disabled={busy}
              className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer">
              <Ban className="w-4 h-4" /> Revoke
            </button>
          )}
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Meta label="Issued" value={l.issued_date ? new Date(l.issued_date).toLocaleDateString() : '—'} />
        <Meta label="Activated" value={l.activated_at ? new Date(l.activated_at).toLocaleDateString() : '—'} />
        <Meta label="Expires" value={l.expires_at ? new Date(l.expires_at).toLocaleDateString() : '—'} />
        <Meta label="Install" value={l.installation_type || '—'} />
        <Meta label="Max Users" value={l.max_users ?? '—'} />
        <Meta label="Max Devices" value={l.max_devices ?? '—'} />
        <Meta label="Support" value={l.support_level || '—'} />
        <Meta label="Issued By" value={l.issued_by_name || '—'} />
      </div>

      {/* Sections */}
      <Section icon={<Smartphone className="w-4 h-4" />} title={`Devices (${data.devices.length})`}>
        {data.devices.length === 0 ? <Empty text="No registered devices" /> : (
          <SimpleTable
            headers={['Fingerprint', 'Name', 'OS', 'IP', 'Last seen', 'Status']}
            rows={data.devices.map(d => [
              <code key="f" className="font-mono text-xs">{d.device_fingerprint?.slice(0, 16)}…</code>,
              d.device_name || '—',
              d.os || '—',
              d.ip_address || '—',
              new Date(d.last_seen_at).toLocaleString(),
              d.is_active ? 'active' : 'disabled',
            ])}
          />
        )}
      </Section>

      <Section icon={<Globe className="w-4 h-4" />} title={`Allowed Domains (${data.domains.length})`}>
        {data.domains.length === 0 ? <Empty text="No domain restrictions" /> : (
          <ul className="space-y-1">
            {data.domains.map(d => (
              <li key={d.id} className="flex items-center justify-between text-sm">
                <span className="font-mono text-foreground">{d.domain}</span>
                <span className="text-xs text-muted-foreground">{d.verified ? 'verified' : 'unverified'}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={<Calendar className="w-4 h-4" />} title={`Renewal History (${data.renewals.length})`}>
        {data.renewals.length === 0 ? <Empty text="No renewals yet" /> : (
          <SimpleTable
            headers={['Date', 'Previous Expiry', 'New Expiry', 'Days', 'Amount']}
            rows={data.renewals.map(r => [
              new Date(r.created_at).toLocaleDateString(),
              r.previous_expires_at ? new Date(r.previous_expires_at).toLocaleDateString() : '—',
              new Date(r.new_expires_at).toLocaleDateString(),
              r.duration_days ?? '—',
              r.amount ? `${r.currency} ${Number(r.amount).toLocaleString()}` : '—',
            ])}
          />
        )}
      </Section>

      <Section icon={<Activity className="w-4 h-4" />} title={`Recent Events (${data.events.length})`}>
        {data.events.length === 0 ? <Empty text="No events recorded" /> : (
          <ul className="space-y-2">
            {data.events.map(e => (
              <li key={e.id} className="flex items-start gap-3 text-sm border-b border-border pb-2 last:border-0">
                <span className="text-xs text-muted-foreground w-32 shrink-0">{new Date(e.created_at).toLocaleString()}</span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-muted">{e.event_type}</span>
                <span className="text-muted-foreground flex-1">{e.description || '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Modals */}
      {modal === 'suspend' && (
        <ActionModal title="Suspend License" onClose={() => setModal(null)}
          onConfirm={() => act('suspend', { reason: modalInput.reason })}
          confirmLabel="Suspend" busy={busy} confirmTone="yellow">
          <Textarea label="Reason *" value={modalInput.reason || ''} onChange={v => setModalInput(s => ({ ...s, reason: v }))} />
        </ActionModal>
      )}
      {modal === 'revoke' && (
        <ActionModal title="Revoke License" onClose={() => setModal(null)}
          onConfirm={() => act('revoke', { reason: modalInput.reason })}
          confirmLabel="Revoke" busy={busy} confirmTone="red"
          warning="Revocation cannot be undone. All devices will be disabled.">
          <Textarea label="Reason *" value={modalInput.reason || ''} onChange={v => setModalInput(s => ({ ...s, reason: v }))} />
        </ActionModal>
      )}
      {modal === 'renew' && (
        <ActionModal title="Renew License" onClose={() => setModal(null)}
          onConfirm={() => act('renew', {
            duration_days: modalInput.duration_days ? parseInt(modalInput.duration_days, 10) : undefined,
            new_expires_at: modalInput.new_expires_at || undefined,
            amount: modalInput.amount ? parseFloat(modalInput.amount) : undefined,
            currency: modalInput.currency || 'UGX',
            notes: modalInput.notes,
          })}
          confirmLabel="Renew" busy={busy} confirmTone="blue">
          <Input label="Duration (days)" type="number" value={modalInput.duration_days || ''} onChange={v => setModalInput(s => ({ ...s, duration_days: v }))} />
          <div className="text-xs text-center text-muted-foreground">— or —</div>
          <Input label="New expires at" type="date" value={modalInput.new_expires_at || ''} onChange={v => setModalInput(s => ({ ...s, new_expires_at: v }))} />
          <Input label="Amount" type="number" value={modalInput.amount || ''} onChange={v => setModalInput(s => ({ ...s, amount: v }))} />
          <Input label="Currency" value={modalInput.currency || 'UGX'} onChange={v => setModalInput(s => ({ ...s, currency: v }))} />
          <Textarea label="Notes" value={modalInput.notes || ''} onChange={v => setModalInput(s => ({ ...s, notes: v }))} />
        </ActionModal>
      )}
      {modal === 'transfer' && (
        <ActionModal title="Transfer License" onClose={() => setModal(null)}
          onConfirm={() => act('transfer', {
            new_client_name: modalInput.new_client_name,
            reason: modalInput.reason,
          })}
          confirmLabel="Transfer" busy={busy} confirmTone="purple"
          warning="All registered devices will be reset.">
          <Input label="New Client Name *" value={modalInput.new_client_name || ''} onChange={v => setModalInput(s => ({ ...s, new_client_name: v }))} />
          <Textarea label="Reason *" value={modalInput.reason || ''} onChange={v => setModalInput(s => ({ ...s, reason: v }))} />
        </ActionModal>
      )}
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground mt-0.5">{value}</div>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground flex items-center gap-2 mb-3">{icon} {title}</h2>
      {children}
    </div>
  );
}

function Empty({ text }) {
  return <div className="text-sm text-muted-foreground text-center py-4">{text}</div>;
}

function SimpleTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {headers.map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2 text-foreground">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TONE = {
  red:    'bg-red-600 hover:bg-red-700',
  yellow: 'bg-yellow-600 hover:bg-yellow-700',
  blue:   'bg-blue-600 hover:bg-blue-700',
  purple: 'bg-purple-600 hover:bg-purple-700',
};

function ActionModal({ title, children, onClose, onConfirm, confirmLabel, confirmTone = 'blue', busy, warning }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full p-6 space-y-4">
        <h3 className="font-semibold text-foreground text-lg">{title}</h3>
        {warning && (
          <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {warning}
          </div>
        )}
        <div className="space-y-3">{children}</div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition cursor-pointer">
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${TONE[confirmTone]} disabled:opacity-50 cursor-pointer`}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

function Input({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className={inputCls} />
    </div>
  );
}
function Textarea({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className={inputCls} />
    </div>
  );
}
