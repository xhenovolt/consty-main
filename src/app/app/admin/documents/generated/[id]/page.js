'use client';

import { useEffect, useState, use, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft, Edit3, Save, X, Loader2, AlertTriangle, CheckCircle2,
  Eye, Printer, Trash2, Ban, RotateCcw, ExternalLink, FileText,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { renderDocumentBody } from '@/lib/doc-render';

const fmtDate     = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
// Render a Date as the value <input type="date"/> expects (YYYY-MM-DD).
const toDateInput = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

export default function GeneratedDocumentDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showRevoke, setShowRevoke] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetchWithAuth(`/api/documents/generated/${id}`).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Not found');
      setDoc(r.data);
      const pdata = (typeof r.data.placeholder_data === 'string')
        ? (() => { try { return JSON.parse(r.data.placeholder_data); } catch { return {}; } })()
        : (r.data.placeholder_data || {});
      setForm({
        title: r.data.title || '',
        recipient_name:  r.data.recipient_name  || '',
        recipient_email: r.data.recipient_email || '',
        recipient_phone: r.data.recipient_phone || '',
        expires_at:      toDateInput(r.data.expires_at),
        placeholder_data_text: JSON.stringify(pdata, null, 2),
      });
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const placeholderData = useMemo(() => {
    if (typeof doc?.placeholder_data === 'string') {
      try { return JSON.parse(doc.placeholder_data); } catch { return {}; }
    }
    return doc?.placeholder_data || {};
  }, [doc]);

  const verifyUrl = useMemo(() => {
    if (!doc?.unique_id || typeof window === 'undefined') return '';
    return `${window.location.origin}/verify/${doc.unique_id}`;
  }, [doc]);

  const save = async () => {
    // Validate placeholder_data is valid JSON before the round trip.
    let parsed;
    try { parsed = JSON.parse(form.placeholder_data_text || '{}'); }
    catch { toast.error('Placeholder data must be valid JSON'); return; }

    setSaving(true);
    try {
      const r = await fetchWithAuth(`/api/documents/generated/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          recipient_name: form.recipient_name,
          recipient_email: form.recipient_email || null,
          recipient_phone: form.recipient_phone || null,
          // Empty string => null = "no expiry"
          expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
          placeholder_data: parsed,
        }),
      }).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Save failed');
      toast.success('Document updated');
      setEdit(false);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const setRevoked = async (revoke) => {
    setBusy(true);
    try {
      const r = await fetchWithAuth(`/api/documents/generated/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_revoked: revoke,
          revocation_reason: revoke ? (revokeReason || null) : null,
        }),
      }).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Failed');
      toast.success(revoke ? 'Document revoked' : 'Document restored');
      setShowRevoke(false);
      setRevokeReason('');
      load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm('Permanently delete this document? Existing QR codes will stop verifying.')) return;
    setBusy(true);
    try {
      const r = await fetchWithAuth(`/api/documents/generated/${id}`, { method: 'DELETE' }).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Failed');
      toast.success('Deleted');
      router.push('/app/admin/documents/generated');
    } catch (e) { toast.error(e.message); setBusy(false); }
  };

  const handlePrint = () => { if (typeof window !== 'undefined') window.print(); };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-muted rounded w-64" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Link href="/app/admin/documents/generated" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-xl p-6 text-center">
          <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
          {error || 'Document not found'}
        </div>
      </div>
    );
  }

  const isRevoked = doc.is_revoked;
  const expired   = doc.expires_at && new Date(doc.expires_at) < new Date();
  const statusBadge = isRevoked
    ? { label: 'Revoked', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
    : expired
      ? { label: 'Expired', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }
      : { label: doc.status || 'Issued', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Link href="/app/admin/documents/generated" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to generated documents
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 print:hidden">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-foreground truncate">{doc.title}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.cls}`}>{statusBadge.label}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">{doc.unique_id}</div>
            <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-3">
              <span>For <strong className="text-foreground">{doc.recipient_name}</strong></span>
              <span>Issued {fmtDate(doc.generated_at)}</span>
              {doc.expires_at && <span className={expired ? 'text-amber-600' : ''}>Expires {fmtDate(doc.expires_at)}</span>}
              <span>{doc.viewed_count || 0} verification view{doc.viewed_count === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/verify/${doc.unique_id}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted cursor-pointer">
            <ExternalLink className="w-4 h-4" /> Public verify page
          </a>
          <button onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted cursor-pointer">
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
          {!edit ? (
            <>
              <button onClick={() => setEdit(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted cursor-pointer">
                <Edit3 className="w-4 h-4" /> Edit
              </button>
              {isRevoked ? (
                <button onClick={() => setRevoked(false)} disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">
                  <RotateCcw className="w-4 h-4" /> Restore
                </button>
              ) : (
                <button onClick={() => setShowRevoke(true)} disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 dark:border-amber-900 text-amber-700 dark:text-amber-400 rounded-lg text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer disabled:opacity-50">
                  <Ban className="w-4 h-4" /> Revoke
                </button>
              )}
              <button onClick={remove} disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer disabled:opacity-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setEdit(false); load(); }} disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted disabled:opacity-50 cursor-pointer">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 cursor-pointer">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit form */}
      {edit && (
        <div className="bg-card border border-border rounded-xl p-5 grid grid-cols-1 lg:grid-cols-2 gap-4 print:hidden">
          <div className="space-y-3">
            <Field label="Title">
              <input value={form.title} onChange={e => setForm(s => ({ ...s, title: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Recipient name">
              <input value={form.recipient_name} onChange={e => setForm(s => ({ ...s, recipient_name: e.target.value }))} className={inputCls} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Recipient email">
                <input type="email" value={form.recipient_email} onChange={e => setForm(s => ({ ...s, recipient_email: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Recipient phone">
                <input value={form.recipient_phone} onChange={e => setForm(s => ({ ...s, recipient_phone: e.target.value }))} className={inputCls} />
              </Field>
            </div>
            <Field label="Expires at">
              <div className="flex gap-2">
                <input type="date" value={form.expires_at}
                  onChange={e => setForm(s => ({ ...s, expires_at: e.target.value }))} className={inputCls} />
                {form.expires_at && (
                  <button type="button" onClick={() => setForm(s => ({ ...s, expires_at: '' }))}
                    className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted cursor-pointer">
                    Clear
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Empty = no expiry. Verification page treats an expired doc as invalid.</p>
            </Field>
          </div>
          <div>
            <Field label="Placeholder data (JSON)">
              <textarea value={form.placeholder_data_text}
                onChange={e => setForm(s => ({ ...s, placeholder_data_text: e.target.value }))}
                rows={16}
                className={`${inputCls} font-mono text-xs leading-relaxed`}
                spellCheck={false} />
              <p className="text-xs text-muted-foreground mt-1">
                Substituted into the template at render time. Common keys: <code>applicant_name</code>, <code>registration_number</code>, <code>training_period</code>, <code>organization_name</code>.
              </p>
            </Field>
          </div>
        </div>
      )}

      {/* Document sheet — same paper layout as the public verify page so
          what you preview here matches what gets printed and what the QR
          recipient sees. */}
      <div id="print-area" className="rounded-lg bg-slate-200 dark:bg-slate-900 p-4 sm:p-8">
        <article
          className="doc-paper mx-auto bg-white text-slate-900 shadow-md font-serif relative"
          style={{ width: '210mm', minHeight: '297mm', padding: '20mm 18mm' }}
        >
          {doc.branding && (
            <header className="border-b border-slate-300 pb-4 mb-6 flex items-start gap-4">
              {doc.branding.logo_url && (
                <img src={doc.branding.logo_url} alt="logo" className="h-16 w-16 object-contain shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold leading-tight">{doc.branding.organization_name || 'Organization'}</h2>
                {doc.branding.header_text && <p className="text-xs text-slate-600 mt-0.5">{doc.branding.header_text}</p>}
                <div className="text-xs text-slate-600 mt-1 space-x-2">
                  {doc.branding.email   && <span>{doc.branding.email}</span>}
                  {doc.branding.phone   && <span>· {doc.branding.phone}</span>}
                  {doc.branding.website && <span>· {doc.branding.website}</span>}
                  {(doc.branding.address_line1 || doc.branding.country) && (
                    <span>· {[doc.branding.address_line1, doc.branding.city, doc.branding.country].filter(Boolean).join(', ')}</span>
                  )}
                </div>
              </div>
            </header>
          )}

          <div className="text-[12pt] leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: doc.rendered_body
                ? (doc.body_format === 'html' || doc.body_format === 'rich'
                    ? doc.rendered_body
                    : renderDocumentBody(doc.rendered_body, doc.body_format || 'markdown'))
                : '<p class="italic text-slate-500">Document body not available.</p>'
            }}
          />

          <footer className="mt-12 pt-6 border-t border-slate-300 flex items-end justify-between gap-6">
            <div className="text-xs text-slate-600 flex-1 min-w-0">
              <div className="font-semibold text-slate-700 mb-1">Authenticity Verification</div>
              <div>Document ID: <code className="font-mono text-[11pt] text-slate-900">{doc.unique_id}</code></div>
              <div>Issued: {fmtDate(doc.generated_at)}</div>
              {doc.expires_at && <div>Expires: {fmtDate(doc.expires_at)}</div>}
              {isRevoked && <div className="text-red-700 font-semibold mt-1">REVOKED · {doc.revocation_reason || ''}</div>}
              <div className="mt-2 break-all">Scan QR or visit: <span className="font-mono text-[10pt]">{verifyUrl}</span></div>
            </div>
            {verifyUrl && (
              <div className="text-center shrink-0">
                <div className="bg-white p-2 border border-slate-300 rounded">
                  <QRCodeSVG value={verifyUrl} size={120} level="M" includeMargin={false} />
                </div>
                <div className="text-[9pt] text-slate-500 mt-1">Scan to verify</div>
              </div>
            )}
          </footer>
        </article>
      </div>

      {/* Placeholder data summary (collapsed) */}
      <details className="bg-card border border-border rounded-xl p-5 print:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Placeholder data (used by template substitution)</summary>
        <pre className="mt-3 text-xs font-mono bg-muted/30 border border-border rounded p-3 overflow-x-auto">
{JSON.stringify(placeholderData, null, 2)}
        </pre>
      </details>

      {/* Revoke modal */}
      {showRevoke && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-lg">Revoke document</h3>
              <button onClick={() => setShowRevoke(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Existing QR codes will show <strong>Revoked</strong> on the public verification page. The document row stays in the database — you can Restore later.
              </span>
            </div>
            <Field label="Reason (optional)">
              <textarea value={revokeReason} onChange={e => setRevokeReason(e.target.value)} rows={3} className={inputCls} />
            </Field>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowRevoke(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted cursor-pointer">
                Cancel
              </button>
              <button onClick={() => setRevoked(true)} disabled={busy}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 cursor-pointer">
                {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print stylesheet — same recipe as the public verify page */}
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: white !important; }
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area {
            position: absolute; inset: 0; padding: 0 !important;
            background: white !important; border: 0 !important; box-shadow: none !important;
            max-height: none !important; overflow: visible !important;
          }
          #print-area .doc-paper {
            margin: 0 !important; box-shadow: none !important; border: 0 !important;
            width: 210mm !important; min-height: 297mm !important;
          }
        }
      `}</style>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}
