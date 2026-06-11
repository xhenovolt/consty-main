'use client';

import { useEffect, useState } from 'react';
import { Calendar, Plus, Check, Clock, Phone, Mail, Users, Video, FileText, Filter } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';

const TYPE_ICONS = { call: Phone, email: Mail, meeting: Users, demo: Video, proposal: FileText, site_visit: Users, social: Mail, other: Calendar };
const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-700', completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-muted text-muted-foreground', rescheduled: 'bg-orange-100 text-orange-700', no_show: 'bg-red-100 text-red-700',
};

export default function FollowupsPage() {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming');
  const [showForm, setShowForm] = useState(false);
  const [prospects, setProspects] = useState([]);
  const [form, setForm] = useState({ prospect_id: '', type: 'call', scheduled_date: '', scheduled_time: '', summary: '', next_action: '' });
  const toast = useToast();

  useEffect(() => { fetchFollowups(); fetchProspects(); }, [filter]);

  const fetchFollowups = async () => {
    try {
      let url = '/api/followups';
      if (filter === 'upcoming') url += '?upcoming=true';
      else if (filter !== 'all') url += `?status=${filter}`;
      const res = await fetchWithAuth(url);
      const json = await res.json();
      if (json.success) setFollowups(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchProspects = async () => {
    try {
      const res = await fetchWithAuth('/api/prospects?limit=200');
      const json = await res.json();
      if (json.success) setProspects(json.data);
    } catch (err) { console.error(err); }
  };

  const createFollowup = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/followups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        ...form,
        // Combine date + optional time into a single ISO datetime
        scheduled_at: form.scheduled_date
          ? form.scheduled_time
            ? `${form.scheduled_date}T${form.scheduled_time}`
            : `${form.scheduled_date}T09:00:00`
          : null,
      }),
      });
      const json = await res.json();
      if (json.success) { toast.success('Follow-up scheduled'); setShowForm(false); setForm({ prospect_id: '', type: 'call', scheduled_date: '', scheduled_time: '', summary: '', next_action: '' }); fetchFollowups(); }
    } catch (err) { console.error(err); }
  };

  const markComplete = async (id) => {
    try {
      const res = await fetchWithAuth(`/api/followups/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if ((await res.json()).success) { toast.success('Marked as complete'); fetchFollowups(); }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Follow-ups</h1>
          <p className="text-sm text-muted-foreground mt-1">{followups.length} follow-ups</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Schedule Follow-up
        </button>
      </div>

      {showForm && (
        <form onSubmit={createFollowup} className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-foreground">New Follow-up</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select required value={form.prospect_id} onChange={e => setForm({...form, prospect_id: e.target.value})} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground [&>option]:bg-background">
              <option value="">Select Prospect *</option>
              {prospects.map(p => <option key={p.id} value={p.id}>{p.company_name}</option>)}
            </select>
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground [&>option]:bg-background">
              {['call','email','meeting','demo','proposal','site_visit','social','other'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </select>
            {/* Date — required */}
            <input required type="date" value={form.scheduled_date} onChange={e => setForm({...form, scheduled_date: e.target.value})} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" title="Follow-up date" />
            {/* Time — optional */}
            <div>
              <input type="time" value={form.scheduled_time} onChange={e => setForm({...form, scheduled_time: e.target.value})} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground w-full" />
              <p className="text-xs text-muted-foreground mt-1">Time is optional — defaults to 9:00 AM</p>
            </div>
            <input value={form.summary} onChange={e => setForm({...form, summary: e.target.value})} placeholder="Summary (optional)" className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition">Cancel</button>
          </div>
        </form>
      )}

      <div className="flex gap-2">
        {['upcoming','scheduled','completed','all'].map(f => (
          <button key={f} onClick={() => { setFilter(f); setLoading(true); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>{f}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : followups.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No follow-ups found</div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {followups.map(f => {
            const Icon = TYPE_ICONS[f.type] || Calendar;
            return (
              <div key={f.id} className="flex items-center justify-between p-4 hover:bg-muted">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><Icon className="w-4 h-4 text-muted-foreground" /></div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/app/prospects/${f.prospect_id}`} className="text-sm font-medium text-blue-600 hover:underline">{f.prospect_name}</Link>
                      <span className="text-xs capitalize text-muted-foreground">{f.type}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[f.status]}`}>{f.status}</span>
                    </div>
                    {f.summary && <p className="text-xs text-muted-foreground mt-0.5">{f.summary}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground"><Clock className="w-3 h-3 inline mr-1" />{new Date(f.scheduled_at).toLocaleString()}</span>
                  {f.status === 'scheduled' && (
                    <button onClick={() => markComplete(f.id)} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700"><Check className="w-3 h-3" /> Done</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
