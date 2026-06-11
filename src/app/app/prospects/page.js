'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Search, ChevronRight, Zap, AlertTriangle, Building2, Phone, Mail, Calendar } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { useFormSubmit } from '@/lib/useFormSubmit';
import { SkeletonTable, SkeletonCards } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { ViewToggle } from '@/components/ui/ViewToggle';

const STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'dormant'];
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

/** Parse quick-capture strings like "John logistics 700k" */
function parseQuickCapture(text) {
  if (!text.trim()) return null;
  const valueMatch = text.match(/(\d[\d,]*(?:\.\d+)?)\s*([kKmMbB]?)\s*$/);
  let estimated_value = null;
  let estimated_value_text = null;
  let company_name = text.trim();
  if (valueMatch) {
    const num = parseFloat(valueMatch[1].replace(/,/g, ''));
    const multiplier = { k: 1000, K: 1000, m: 1e6, M: 1e6, b: 1e9, B: 1e9 }[valueMatch[2]] || 1;
    estimated_value = num * multiplier;
    estimated_value_text = valueMatch[0].trim();
    company_name = text.slice(0, text.lastIndexOf(valueMatch[0])).trim() || text.trim();
  }
  return { company_name, estimated_value, estimated_value_text, currency: 'UGX', stage: 'new' };
}

export default function ProspectsPage() {
  const searchParams = useSearchParams();
  const [prospects, setProspects] = useState([]);
  const [systems, setSystems] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [quickCapturing, setQuickCapturing] = useState(false);
  const quickInputRef = useRef(null);
  const [form, setForm] = useState({
    company_name: '', contact_name: '', email: '', phone: '',
    source: '', stage: 'new', priority: 'medium',
    estimated_value: '', currency: 'UGX', notes: '', pipeline: '', next_followup_date: '',
    system_id: '', service_id: '',
  });

  // Fetch systems and services for dropdowns
  useEffect(() => {
    fetchWithAuth('/api/systems').then(r => r.json()).then(d => setSystems(d.data || d.systems || []));
    fetchWithAuth('/api/services?active=true').then(r => r.json()).then(d => setServices(d.data || d.services || []));
  }, []);

  // Auto-focus quick input if ?new=1 (from sidebar quick-add)
  useEffect(() => {
    if (searchParams.get('new') === '1') quickInputRef.current?.focus();
  }, [searchParams]);

  const fetchProspects = useCallback(async () => {
    try {
      let url = '/api/prospects?limit=100';
      if (stageFilter) url += `&stage=${stageFilter}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await fetchWithAuth(url);
      const json = await res.json();
      if (json.success) setProspects(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [stageFilter, search]);

  useEffect(() => { fetchProspects(); }, [stageFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setLoading(true);
    fetchProspects();
  };

  const handleQuickCapture = async (e) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    setQuickCapturing(true);
    const parsed = parseQuickCapture(quickInput);
    if (!parsed) { setQuickCapturing(false); return; }
    try {
      const res = await fetchWithAuth('/api/prospects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const json = await res.json();
      if (json.success) { setQuickInput(''); setLoading(true); fetchProspects(); }
    } catch (err) { console.error(err); } finally { setQuickCapturing(false); }
  };

  const createProspect = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/prospects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
          system_id: form.system_id || null,
          service_id: form.service_id || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        setForm({ company_name: '', contact_name: '', email: '', phone: '', source: '', stage: 'new', priority: 'medium', estimated_value: '', currency: 'UGX', notes: '', pipeline: '', next_followup_date: '', system_id: '', service_id: '' });
        setLoading(true); fetchProspects();
      }
    } catch (err) { console.error(err); }
  };

  const total = prospects.length;
  const unassigned = prospects.filter(p => !p.pipeline).length;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prospects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} total
            {unassigned > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="inline w-3 h-3 mb-0.5 mr-0.5" />
                {unassigned} unassigned
              </span>
            )}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
          <Plus className="w-4 h-4" /> New Prospect
        </button>
      </div>

      {/* Quick Capture */}
      <form onSubmit={handleQuickCapture} className="flex gap-2">
        <div className="relative flex-1">
          <Zap className="w-4 h-4 absolute left-3 top-2.5 text-amber-500" />
          <input
            ref={quickInputRef}
            value={quickInput}
            onChange={e => setQuickInput(e.target.value)}
            placeholder='Quick add: "John logistics 700k" — press Enter to capture'
            className="w-full border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>
        <button type="submit" disabled={!quickInput.trim() || quickCapturing} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-50 transition">
          {quickCapturing ? 'Saving…' : 'Capture'}
        </button>
      </form>

      {/* Full Create Form */}
      {showForm && (
        <form onSubmit={createProspect} className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-foreground">New Prospect</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input required value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} placeholder="Company / Prospect Name *" className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
            <input value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} placeholder="Contact Name (optional)" className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email (optional)" className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone (optional)" className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
            <select value={form.source} onChange={e => setForm({...form, source: e.target.value})} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground [&>option]:bg-background">
              <option value="">Source (optional)</option>
              {['referral','cold_outreach','inbound','event','social_media','website','partner','other'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
              ))}
            </select>
            <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground [&>option]:bg-background">
              {['low','medium','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="flex gap-2">
              <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className="border border-border rounded-lg px-2 py-2 text-sm bg-background text-foreground w-24 [&>option]:bg-background">
                {['UGX','USD','EUR','KES','TZS'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" value={form.estimated_value} onChange={e => setForm({...form, estimated_value: e.target.value})} placeholder="Estimated value" className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
            </div>
            <select value={form.pipeline} onChange={e => setForm({...form, pipeline: e.target.value})} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground [&>option]:bg-background">
              <option value="">Pipeline (optional)</option>
              {PIPELINES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={form.system_id} onChange={e => setForm({...form, system_id: e.target.value})} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground [&>option]:bg-background">
              <option value="">Interested in system (optional)</option>
              {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={form.service_id} onChange={e => setForm({...form, service_id: e.target.value})} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground [&>option]:bg-background">
              <option value="">Interested in service (optional)</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="date" value={form.next_followup_date} onChange={e => setForm({...form, next_followup_date: e.target.value})} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" title="Follow-up date (optional)" />
          </div>
          <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Notes (optional)" className="border border-border rounded-lg px-3 py-2 text-sm w-full bg-background text-foreground" rows={2} />
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition">Cancel</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-52 bg-background text-foreground" />
          </div>
        </form>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setStageFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!stageFilter ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>All</button>
          {STAGES.filter(s => s !== 'won' && s !== 'lost').map(s => (
            <button key={s} onClick={() => setStageFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${stageFilter === s ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>{s}</button>
          ))}
        </div>
        <select value={pipelineFilter} onChange={e => setPipelineFilter(e.target.value)} className="border border-border rounded-lg px-3 py-1.5 text-xs bg-background text-foreground [&>option]:bg-background">
          <option value="">All systems</option>
          {PIPELINES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Prospect List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <p className="text-muted-foreground">No prospects found</p>
          <button onClick={() => quickInputRef.current?.focus()} className="text-blue-600 text-sm mt-2 hover:underline">Use quick capture above →</button>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {prospects.map(p => (
            <Link key={p.id} href={`/app/prospects/${p.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50 transition group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground truncate">{p.company_name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ${STAGE_COLORS[p.stage] || 'bg-muted'}`}>{p.stage}</span>
                  {p.priority === 'urgent' && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 shrink-0">Urgent</span>}
                  {p.priority === 'high' && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 shrink-0">High</span>}
                  {!p.pipeline && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 shrink-0" title="Not attached to any system">Unassigned</span>}
                  {p.pipeline && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground shrink-0">{p.pipeline}</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {p.contact_name && <span>{p.contact_name}</span>}
                  {p.next_followup_date && <span>Follow-up: {new Date(p.next_followup_date).toLocaleDateString()}</span>}
                  {p.followup_count > 0 && <span>{p.followup_count} log entries</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {p.estimated_value && <span className="text-sm font-semibold text-foreground">{formatCurrency(p.estimated_value, p.currency || 'UGX')}</span>}
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
