'use client';

import { useEffect, useState, use, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Edit3, Save, Trash2, FileText, Tag, Calendar, X, Loader2, AlertTriangle, CheckCircle2,
  Eye, Code2, Printer, Send, Sparkles,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { renderDocumentBody } from '@/lib/doc-render';

const CATEGORIES = ['HR', 'Legal', 'Operations', 'Finance', 'Technical', 'General'];
const BODY_FORMATS = ['markdown', 'rich', 'plain', 'html'];

// Extract `{{placeholders}}` from a body string. Used to show the user which
// dynamic variables the template will substitute at generation time.
function extractPlaceholders(body) {
  if (!body) return [];
  const set = new Set();
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  let m;
  while ((m = re.exec(body))) set.add(m[1]);
  return [...set].sort();
}

const fmtDate = (d) => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function TemplateDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'raw'

  // Generation state — the missing arc that lets a user actually turn a
  // template into a real document. Auto-opens when ?generate=1 is in the
  // URL so the "New Document" flow on the generated-docs list can deep-
  // link straight here.
  const searchParams = useSearchParams();
  const [showGen, setShowGen] = useState(false);
  const [genForm, setGenForm] = useState({
    document_type: 'other',
    recipient_name: '',
    recipient_email: '',
    recipient_phone: '',
    expires_in_days: 365,
    placeholder_values: {}, // keyed by placeholder name
  });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (searchParams?.get('generate') === '1') setShowGen(true);
  }, [searchParams]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetchWithAuth(`/api/documents/templates/${id}`).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Template not found');
      setTemplate(r.data);
      setForm({
        name:        r.data.name || '',
        description: r.data.description || '',
        category:    r.data.category || 'General',
        body:        r.data.body || '',
        body_format: r.data.body_format || 'markdown',
        is_active:   r.data.is_active !== false,
      });
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const placeholders = useMemo(() => extractPlaceholders(form.body || template?.body), [form.body, template]);

  // Pre-rendered HTML for the paper-style preview. We re-render whenever the
  // body or format changes — in edit mode that means live preview as the
  // user types in the textarea.
  const previewHtml = useMemo(
    () => renderDocumentBody(
      edit ? form.body : template?.body,
      (edit ? form.body_format : template?.body_format) || 'markdown'
    ),
    [edit, form.body, form.body_format, template]
  );

  // Native browser print. The print stylesheet at the bottom of the
  // component hides everything except #print-area, so users get a clean
  // page they can either send to a printer or "Save as PDF" via their
  // browser's print dialog. No extra dependencies, no server round-trip.
  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  // When the generate modal opens (or the template's placeholders change),
  // seed an empty value for every placeholder so the form has fields ready.
  // Skip the recipient_* / applicant_* ones since they map to dedicated
  // fields above.
  const reservedKeys = new Set(['recipient_name','recipient_email','recipient_phone','applicant_name','applicant_email','applicant_phone']);
  const customPlaceholders = useMemo(
    () => placeholders.filter(p => !reservedKeys.has(p)),
    [placeholders]
  );
  useEffect(() => {
    if (!showGen) return;
    setGenForm(prev => {
      const next = { ...prev.placeholder_values };
      for (const p of customPlaceholders) if (!(p in next)) next[p] = '';
      // Sensible defaults for the most common ones
      if (!next.issue_date) next.issue_date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
      return { ...prev, placeholder_values: next };
    });
  }, [showGen, customPlaceholders.join('|')]);

  // Suggest a sensible document_type prefix based on the template category.
  // The generate endpoint uses the first 3 letters of document_type for the
  // unique ID prefix (XTN-INT-..., XTN-CER-..., etc.), so we want something
  // meaningful.
  const suggestedType = useMemo(() => {
    const cat = (template?.category || '').toLowerCase();
    if (cat.includes('intern')) return 'internship_acceptance';
    if (cat.includes('cert'))   return 'certificate';
    if (cat.includes('hr'))     return 'hr_letter';
    if (cat.includes('legal'))  return 'legal_document';
    if (cat.includes('finance'))return 'invoice';
    return 'letter';
  }, [template]);
  useEffect(() => {
    if (showGen && genForm.document_type === 'other') {
      setGenForm(p => ({ ...p, document_type: suggestedType }));
    }
  }, [showGen, suggestedType]);

  const generate = async () => {
    if (!genForm.recipient_name.trim()) {
      toast.error('Recipient name is required');
      return;
    }
    setGenerating(true);
    try {
      const r = await fetchWithAuth('/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template.id,
          document_type:   genForm.document_type || 'other',
          recipient_name:  genForm.recipient_name,
          recipient_email: genForm.recipient_email || undefined,
          recipient_phone: genForm.recipient_phone || undefined,
          expires_in_days: Number(genForm.expires_in_days) || null,
          placeholder_data: genForm.placeholder_values,
        }),
      }).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Generation failed');
      toast.success(`Document ${r.data?.unique_id || ''} generated`);
      setShowGen(false);
      // Jump to the new document so the user can preview/print immediately.
      if (r.data?.id) router.push(`/app/admin/documents/generated/${r.data.id}`);
      else router.push('/app/admin/documents/generated');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetchWithAuth(`/api/documents/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          category: form.category,
          body: form.body,
          body_format: form.body_format,
          variables: placeholders,
          is_active: form.is_active,
        }),
      }).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Save failed');
      toast.success('Template updated');
      setEdit(false);
      setTemplate(r.data);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      const r = await fetchWithAuth(`/api/documents/templates/${id}`, { method: 'DELETE' }).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Delete failed');
      toast.success('Template deleted');
      router.push('/app/admin/documents/templates');
    } catch (e) {
      toast.error(e.message);
      setShowDelete(false);
    } finally { setDeleting(false); }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Link href="/app/admin/documents/templates" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to templates
        </Link>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-xl p-6 text-center">
          <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
          {error || 'Template not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href="/app/admin/documents/templates" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to templates
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-foreground truncate">{template.name}</h1>
              {template.is_active === false && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">inactive</span>
              )}
              {template.category && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  {template.category}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground capitalize">
                {template.body_format || 'markdown'}
              </span>
            </div>
            {template.description && <p className="text-sm text-muted-foreground mt-1">{template.description}</p>}
            <div className="text-xs text-muted-foreground mt-2 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> Created {fmtDate(template.created_at)}</span>
              {template.updated_at && template.updated_at !== template.created_at && (
                <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> Updated {fmtDate(template.updated_at)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {/* Primary action: turn this template into a real document. */}
          <button onClick={() => setShowGen(true)} disabled={template.is_active === false}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            title={template.is_active === false ? 'Activate this template to generate documents' : 'Generate a document from this template'}>
            <Sparkles className="w-4 h-4" /> Generate Document
          </button>
          <button onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted cursor-pointer"
            title="Open browser print dialog — use to print or Save as PDF">
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
          {!edit ? (
            <>
              <button onClick={() => setEdit(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted cursor-pointer">
                <Edit3 className="w-4 h-4" /> Edit
              </button>
              <button onClick={() => setShowDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer">
                <Trash2 className="w-4 h-4" /> Delete
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

      {/* Body editor / preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 space-y-3">
          {edit ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Name">
                  <input value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="Category">
                  <select value={form.category} onChange={e => setForm(s => ({ ...s, category: e.target.value }))} className={`${inputCls} [&>option]:bg-background`}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Body format">
                  <select value={form.body_format} onChange={e => setForm(s => ({ ...s, body_format: e.target.value }))} className={`${inputCls} [&>option]:bg-background`}>
                    {BODY_FORMATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <label className="flex items-center gap-2 px-3 py-2 text-sm">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(s => ({ ...s, is_active: e.target.checked }))} />
                    <span className="text-foreground">Active</span>
                  </label>
                </Field>
              </div>
              <Field label="Description">
                <input value={form.description} onChange={e => setForm(s => ({ ...s, description: e.target.value }))} className={inputCls} />
              </Field>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <Field label="Body (markdown / html)">
                  <textarea value={form.body} onChange={e => setForm(s => ({ ...s, body: e.target.value }))} rows={20}
                    className={`${inputCls} font-mono text-xs leading-relaxed`}
                    placeholder="Use {{placeholder_name}} for dynamic substitutions" />
                </Field>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Live preview</label>
                  <div className="rounded-lg border border-border bg-slate-100 dark:bg-slate-900 p-3 max-h-[480px] overflow-y-auto">
                    {form.body ? (
                      <article
                        className="doc-paper mx-auto bg-white text-slate-900 shadow-md font-serif text-[12px]"
                        style={{ width: '100%', maxWidth: '210mm', padding: '20mm' }}
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground italic text-center py-12">
                        Start typing in the body field to see a preview.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between print:hidden">
                <h2 className="font-semibold text-foreground text-sm uppercase tracking-wide text-muted-foreground">Template Body</h2>
                <div className="flex gap-1 border border-border rounded-lg p-0.5 bg-muted/30">
                  <button onClick={() => setViewMode('preview')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs cursor-pointer transition-colors ${
                      viewMode === 'preview' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                  <button onClick={() => setViewMode('raw')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs cursor-pointer transition-colors ${
                      viewMode === 'raw' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    <Code2 className="w-3.5 h-3.5" /> Raw
                  </button>
                </div>
              </div>
              {/* Preview pane — paper-sized white sheet that the print stylesheet
                  isolates and sends to the printer / PDF as A4. */}
              {viewMode === 'preview' ? (
                template.body ? (
                  <div id="print-area" className="rounded-lg border border-border bg-slate-100 dark:bg-slate-900 p-4 max-h-[800px] overflow-y-auto">
                    <article
                      className="doc-paper mx-auto bg-white text-slate-900 shadow-md font-serif"
                      style={{ width: '210mm', minHeight: '297mm', padding: '20mm' }}
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic text-center py-12 border border-border rounded-lg">
                    No body content. Switch to edit mode to add one.
                  </div>
                )
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-foreground font-mono leading-relaxed bg-muted/30 border border-border rounded-lg p-4 max-h-[800px] overflow-y-auto print:hidden">
                  {template.body || <span className="text-muted-foreground italic">No body content.</span>}
                </pre>
              )}
            </>
          )}
        </div>

        {/* Sidebar: placeholders + metadata */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground text-sm uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <Tag className="w-4 h-4" /> Placeholders
            </h2>
            {placeholders.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No placeholders detected. Add <code className="text-xs bg-muted px-1 py-0.5 rounded">{'{{name}}'}</code> tokens to the body to make this template dynamic.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {placeholders.map(p => (
                  <li key={p} className="px-2 py-0.5 rounded-full text-xs font-mono bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {`{{${p}}}`}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Filled at generation time from recipient data + company branding. Common names: <code>recipient_name</code>, <code>document_id</code>, <code>issue_date</code>, <code>company_name</code>, <code>signatory_name</code>.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground text-sm uppercase tracking-wide text-muted-foreground mb-3">Metadata</h2>
            <dl className="space-y-2 text-sm">
              <Row label="ID"><code className="text-xs">{template.id}</code></Row>
              <Row label="Category">{template.category || '—'}</Row>
              <Row label="Format"><span className="capitalize">{template.body_format || 'markdown'}</span></Row>
              <Row label="Status">
                {template.is_active === false
                  ? <span className="text-muted-foreground">Inactive</span>
                  : <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Active</span>}
              </Row>
              <Row label="Created">{fmtDate(template.created_at)}</Row>
              {template.updated_at && <Row label="Updated">{fmtDate(template.updated_at)}</Row>}
            </dl>
          </div>
        </div>
      </div>

      {/* Print stylesheet — when the user prints (or "Saves as PDF" via the
          browser dialog), hide everything except #print-area and strip its
          chrome so the document sheet alone fills the page at A4. */}
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
            margin: 0 !important; box-shadow: none !important;
            width: 210mm !important; min-height: 297mm !important;
          }
        }
      `}</style>

      {/* Generate-document modal — the missing arc: this is what turns a
          template into an actual generated_documents row. Reads placeholder
          tokens from the template body and renders one input per token, so
          users don't need to know the template internals. */}
      {showGen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" /> Generate document
              </h3>
              <button onClick={() => setShowGen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="text-sm text-muted-foreground">
              From template <strong className="text-foreground">{template.name}</strong>. Branding (company name, logo, contacts) will be pulled from <Link href="/app/settings/company" className="underline">company settings</Link> automatically.
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Recipient name *">
                  <input value={genForm.recipient_name}
                    onChange={e => setGenForm(s => ({ ...s, recipient_name: e.target.value }))}
                    className={inputCls} placeholder="e.g. Mukungu Hatimu" />
                </Field>
                <Field label="Document type">
                  <input value={genForm.document_type}
                    onChange={e => setGenForm(s => ({ ...s, document_type: e.target.value }))}
                    className={inputCls} placeholder="internship_acceptance" />
                </Field>
                <Field label="Recipient email">
                  <input type="email" value={genForm.recipient_email}
                    onChange={e => setGenForm(s => ({ ...s, recipient_email: e.target.value }))}
                    className={inputCls} placeholder="optional" />
                </Field>
                <Field label="Recipient phone">
                  <input value={genForm.recipient_phone}
                    onChange={e => setGenForm(s => ({ ...s, recipient_phone: e.target.value }))}
                    className={inputCls} placeholder="optional" />
                </Field>
                <Field label="Expires in (days)">
                  <input type="number" value={genForm.expires_in_days}
                    onChange={e => setGenForm(s => ({ ...s, expires_in_days: e.target.value }))}
                    className={inputCls} placeholder="365 (blank = never)" />
                </Field>
              </div>

              {customPlaceholders.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2 mt-2 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Template placeholders ({customPlaceholders.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {customPlaceholders.map(p => (
                      <Field key={p} label={<code className="font-mono text-[11px]">{`{{${p}}}`}</code>}>
                        <input value={genForm.placeholder_values[p] || ''}
                          onChange={e => setGenForm(s => ({
                            ...s,
                            placeholder_values: { ...s.placeholder_values, [p]: e.target.value },
                          }))}
                          className={inputCls} placeholder={p.replace(/_/g, ' ')} />
                      </Field>
                    ))}
                  </div>
                </div>
              )}

              {customPlaceholders.length === 0 && (
                <div className="text-xs text-muted-foreground italic">
                  This template has no {`{{placeholders}}`} — the document will be generated as-is with only the recipient + branding filled in.
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowGen(false)}
                className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted cursor-pointer">
                Cancel
              </button>
              <button onClick={generate} disabled={generating || !genForm.recipient_name.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {generating ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-lg">Delete template</h3>
              <button onClick={() => setShowDelete(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Delete <strong>{template.name}</strong>? This cannot be undone. The API will refuse if any generated document still references this template.
              </span>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowDelete(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted cursor-pointer">
                Cancel
              </button>
              <button onClick={remove} disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 cursor-pointer">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
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

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-foreground text-right break-all">{children}</dd>
    </div>
  );
}
