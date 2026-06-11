'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, UserCheck, Trash2, Check, Clock, AlertTriangle, FileText } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete, confirmDangerous } from '@/lib/confirm';
import Link from 'next/link';

const STAGES = ['new','contacted','qualified','proposal','negotiation','won','lost','dormant'];
const STAGE_COLORS = {
  new: 'bg-muted text-foreground',
  contacted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  qualified: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  proposal: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  negotiation: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  won: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  lost: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  dormant: 'bg-muted text-muted-foreground',
};
const PIPELINES = ['CRM', 'Sales', 'Marketing', 'Partnerships', 'Product'];
const CURRENCIES = ['UGX','USD','EUR','KES','TZS'];

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

/** Minimal inline-editable field */
function EditField({ label, value, onChange, type = 'text', placeholder, prefix }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-xs text-muted-foreground shrink-0">{prefix}</span>}
        <input
          type={type}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent border-b border-border focus:border-primary text-sm text-foreground py-1 outline-none transition placeholder:text-muted-foreground/60"
        />
      </div>
    </div>
  );
}

export default function ProspectDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [prospect, setProspect] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle'|'saving'|'saved'
  const [showCustomFollowup, setShowCustomFollowup] = useState(false);
  const saveTimer = useRef(null);
  const toast = useToast();

  useEffect(() => { fetchProspect(); }, [id]);

  const fetchProspect = async () => {
    try {
      const res = await fetchWithAuth(`/api/prospects/${id}`);
      const json = await res.json();
      if (json.success) {
        setProspect(json.data);
        setForm({
          company_name: json.data.company_name || '',
          contact_name: json.data.contact_name || '',
          email: json.data.email || '',
          phone: json.data.phone || '',
          website: json.data.website || '',
          industry: json.data.industry || '',
          source: json.data.source || '',
          stage: json.data.stage || 'new',
          priority: json.data.priority || 'medium',
          estimated_value: json.data.estimated_value ?? '',
          currency: json.data.currency || 'UGX',
          notes: json.data.notes || '',
          pipeline: json.data.pipeline || '',
          next_followup_date: json.data.next_followup_date
            ? json.data.next_followup_date.slice(0, 10) : '',
          next_followup_time: json.data.next_followup_time || '',
        });
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  /** Debounced autosave: schedule a save 1500ms after last change */
  const triggerSave = useCallback((updates) => {
    clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`/api/prospects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        const json = await res.json();
        if (json.success) {
          setProspect(json.data);
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        }
      } catch (err) { console.error(err); setSaveStatus('idle'); }
    }, 1500);
  }, [id]);

  const updateField = (field, value) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    triggerSave({ [field]: value === '' ? null : value });
  };

  const setFollowupQuick = (days) => {
    const date = days === null ? '' : addDays(days);
    updateField('next_followup_date', date);
    setShowCustomFollowup(false);
  };

  const convertToClient = async () => {
    if (!await confirmDangerous('Convert this prospect to a client?', 'Convert Prospect')) return;
    try {
      const res = await fetchWithAuth(`/api/prospects/${id}/convert`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Prospect converted to client!');
        router.push(`/app/clients/${json.data.id}`);
      } else toast.error(json.error);
    } catch (err) { console.error(err); toast.error('Conversion failed'); }
  };

  const deleteProspect = async () => {
    if (!await confirmDelete('prospect')) return;
    try {
      const res = await fetchWithAuth(`/api/prospects/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('Prospect deleted'); router.push('/app/prospects'); }
    } catch (err) { console.error(err); toast.error('Failed to delete'); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!prospect) return <div className="p-6 text-center text-muted-foreground">Prospect not found</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Nav + status */}
      <div className="flex items-center justify-between">
        <Link href="/app/prospects" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Prospects
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {saveStatus === 'saving' && <><Clock className="w-3 h-3 animate-pulse" /> Saving…</>}
          {saveStatus === 'saved' && <><Check className="w-3 h-3 text-emerald-500" /> Saved</>}
        </div>
      </div>

      {/* Header Card */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Editable name */}
            <input
              value={form.company_name}
              onChange={e => updateField('company_name', e.target.value)}
              className="w-full text-2xl font-bold text-foreground bg-transparent border-b-2 border-transparent hover:border-border focus:border-primary outline-none transition"
              placeholder="Prospect name…"
            />
            {/* Stage badges row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STAGE_COLORS[form.stage]}`}>{form.stage}</span>
              {!form.pipeline && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  <AlertTriangle className="w-3 h-3" /> Unassigned
                </span>
              )}
              {form.pipeline && <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">{form.pipeline}</span>}
            </div>
          </div>
          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            {form.stage !== 'won' && form.stage !== 'lost' && (
              <>
                <button onClick={convertToClient} className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs hover:bg-emerald-700 transition">
                  <UserCheck className="w-3.5 h-3.5" /> Convert
                </button>
                <Link href={`/app/prospects/${id}/proposal`} className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-xs hover:bg-blue-700 transition">
                  <FileText className="w-3.5 h-3.5" /> Generate Proposal
                </Link>
              </>
            )}
            <button onClick={deleteProspect} className="p-2 rounded-lg border border-border hover:bg-red-50 dark:hover:bg-red-900/20 transition">
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Details — always editable */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Details</h3>

          {/* Stage selector */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Stage</label>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map(s => (
                <button
                  key={s}
                  onClick={() => updateField('stage', s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition ${form.stage === s ? STAGE_COLORS[s] + ' ring-1 ring-current' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Priority</label>
            <div className="flex gap-1.5">
              {['low','medium','high','urgent'].map(p => (
                <button
                  key={p}
                  onClick={() => updateField('priority', p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition ${form.priority === p ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated value */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Estimated Value</label>
            <div className="flex gap-2 items-center">
              <select
                value={form.currency}
                onChange={e => updateField('currency', e.target.value)}
                className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background text-foreground w-20 [&>option]:bg-background"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="number"
                value={form.estimated_value}
                onChange={e => updateField('estimated_value', e.target.value)}
                placeholder="0"
                className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground"
              />
            </div>
            {form.estimated_value && (
              <p className="text-xs text-muted-foreground mt-1">
                = {formatCurrency(parseFloat(form.estimated_value) || 0, form.currency || 'UGX')}
              </p>
            )}
          </div>

          {/* Pipeline */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">System / Pipeline</label>
            <select
              value={form.pipeline}
              onChange={e => updateField('pipeline', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground [&>option]:bg-background"
            >
              <option value="">None (Unassigned)</option>
              {PIPELINES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Contact</h3>
          <EditField label="Contact Name" value={form.contact_name} onChange={v => updateField('contact_name', v)} placeholder="Full name" />
          <EditField label="Email" value={form.email} onChange={v => updateField('email', v)} type="email" placeholder="email@example.com" />
          <EditField label="Phone" value={form.phone} onChange={v => updateField('phone', v)} placeholder="+256 …" />
          <EditField label="Website" value={form.website} onChange={v => updateField('website', v)} placeholder="https://…" />
          <EditField label="Industry" value={form.industry} onChange={v => updateField('industry', v)} placeholder="e.g. Logistics" />
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Source</label>
            <select
              value={form.source}
              onChange={e => updateField('source', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground [&>option]:bg-background"
            >
              <option value="">Select source</option>
              {['referral','cold_outreach','inbound','event','social_media','website','partner','other'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Follow-up Scheduling */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Follow-up</h3>
        
        {form.next_followup_date && (
          <p className="text-sm text-foreground">
            Scheduled: <span className="font-medium">{new Date(form.next_followup_date + 'T00:00').toLocaleDateString('en-UG', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            {form.next_followup_time && <span className="text-muted-foreground"> at {form.next_followup_time}</span>}
          </p>
        )}

        {/* Quick buttons */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Tomorrow', days: 1 },
            { label: 'Next week', days: 7 },
            { label: '1 month', days: 30 },
          ].map(({ label, days }) => (
            <button key={label} onClick={() => setFollowupQuick(days)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-300 transition dark:bg-blue-900/30 dark:text-blue-300">
              {label}
            </button>
          ))}
          <button onClick={() => setShowCustomFollowup(!showCustomFollowup)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition">
            Custom date
          </button>
          {form.next_followup_date && (
            <button onClick={() => { updateField('next_followup_date', ''); updateField('next_followup_time', ''); }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition dark:bg-red-900/30 dark:text-red-300">
              Clear
            </button>
          )}
        </div>

        {/* Custom date + optional time */}
        {showCustomFollowup && (
          <div className="flex gap-2 flex-wrap pt-1">
            <input
              type="date"
              value={form.next_followup_date}
              onChange={e => updateField('next_followup_date', e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground"
            />
            <input
              type="time"
              value={form.next_followup_time}
              onChange={e => updateField('next_followup_time', e.target.value)}
              placeholder="Time (optional)"
              className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground"
            />
            <span className="text-xs text-muted-foreground self-center">Time is optional</span>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider mb-3">Notes</h3>
        <textarea
          value={form.notes}
          onChange={e => updateField('notes', e.target.value)}
          placeholder="Add notes, observations, or context about this prospect…"
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none min-h-[100px]"
          rows={4}
        />
      </div>

      {/* Follow-up Log */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider mb-3">
          Follow-up Log ({(prospect.followups || []).length})
        </h3>
        {(prospect.followups || []).length === 0 ? (
          <p className="text-muted-foreground text-sm">No log entries yet</p>
        ) : (
          <div className="space-y-2">
            {prospect.followups.map(f => (
              <div key={f.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <span className="text-sm font-medium capitalize">{f.type}</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${f.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : f.status === 'scheduled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-muted text-muted-foreground'}`}>{f.status}</span>
                  {f.summary && <span className="text-xs text-muted-foreground ml-2">{f.summary}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(f.scheduled_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contact list */}
      {(prospect.contacts || []).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider mb-3">
            Contacts ({prospect.contacts.length})
          </h3>
          <div className="space-y-2">
            {prospect.contacts.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <span className="text-sm font-medium text-foreground">{c.name}</span>
                  {c.title && <span className="text-xs text-muted-foreground ml-2">{c.title}</span>}
                  {c.is_primary && <span className="ml-2 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded">Primary</span>}
                </div>
                <div className="text-xs text-muted-foreground">{c.email} {c.phone}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}