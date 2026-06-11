'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/fetch-client';
import {
  Activity, Monitor, Briefcase, CheckCircle, DollarSign,
  AlertCircle, Key, UserPlus, Wrench, RefreshCw, Filter,
} from 'lucide-react';

/** Map event_type to icon + color */
const EVENT_CONFIG = {
  system_created:    { icon: Monitor,      color: 'text-blue-500',    bg: 'bg-blue-100 dark:bg-blue-900/30',    label: 'System Created' },
  deal_created:      { icon: Briefcase,    color: 'text-purple-500',  bg: 'bg-purple-100 dark:bg-purple-900/30', label: 'Deal Created' },
  deal_closed:       { icon: CheckCircle,  color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Deal Closed' },
  payment_received:  { icon: DollarSign,   color: 'text-green-500',   bg: 'bg-green-100 dark:bg-green-900/30',  label: 'Payment Received' },
  issue_reported:    { icon: AlertCircle,  color: 'text-red-500',     bg: 'bg-red-100 dark:bg-red-900/30',      label: 'Issue Reported' },
  issue_fixed:       { icon: CheckCircle,  color: 'text-teal-500',    bg: 'bg-teal-100 dark:bg-teal-900/30',    label: 'Issue Fixed' },
  license_issued:    { icon: Key,          color: 'text-indigo-500',  bg: 'bg-indigo-100 dark:bg-indigo-900/30', label: 'License Issued' },
  staff_added:       { icon: UserPlus,     color: 'text-cyan-500',    bg: 'bg-cyan-100 dark:bg-cyan-900/30',    label: 'Staff Added' },
  change_planned:    { icon: Wrench,       color: 'text-orange-500',  bg: 'bg-orange-100 dark:bg-orange-900/30', label: 'Change Planned' },
};

const DEFAULT_CONFIG = { icon: Activity, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Activity' };

const FILTERS = [
  { label: 'All',      value: '' },
  { label: 'Deals',    value: 'deal_created,deal_closed' },
  { label: 'Payments', value: 'payment_received' },
  { label: 'Systems',  value: 'system_created' },
  { label: 'Issues',   value: 'issue_reported,issue_fixed' },
  { label: 'Licenses', value: 'license_issued' },
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)   return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function EventIcon({ eventType }) {
  const cfg = EVENT_CONFIG[eventType] || DEFAULT_CONFIG;
  const Icon = cfg.icon;
  return (
    <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${cfg.bg}`}>
      <Icon className={`w-4 h-4 ${cfg.color}`} />
    </div>
  );
}

export default function ActivityPage() {
  const [events, setEvents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);
  const [filter, setFilter]         = useState('');
  const [page, setPage]             = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const load = useCallback(async (p = 1, filt = filter, isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const types = filt.split(',').filter(Boolean);
      // If multiple types, fetch each and merge (API supports one at a time)
      let allEvents = [];
      if (types.length > 1) {
        const results = await Promise.all(
          types.map(t => fetchWithAuth(`/api/events?event_type=${t}&limit=25&page=${p}`).then(r => r.json()))
        );
        allEvents = results.flatMap(r => r.data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setPagination({ total: allEvents.length, pages: 1 });
      } else {
        const url = `/api/events?limit=50&page=${p}${filt ? `&event_type=${filt}` : ''}`;
        const json = await fetchWithAuth(url).then(r => r.json());
        allEvents = json.data || [];
        if (json.pagination) setPagination(json.pagination);
      }
      setEvents(allEvents);
      setPage(p);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(1, filter); }, [filter]);

  const handleFilterChange = (val) => { setFilter(val); };

  // Group events by date
  const grouped = events.reduce((acc, event) => {
    const day = new Date(event.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!acc[day]) acc[day] = [];
    acc[day].push(event);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Activity className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Activity Feed</h1>
            <p className="text-sm text-muted-foreground">
              Live heartbeat of the company — {pagination.total} events recorded
            </p>
          </div>
        </div>
        <button
          onClick={() => load(1, filter, true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition text-muted-foreground disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              filter === f.value
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Event types summary bar */}
      {!loading && events.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(
            events.reduce((acc, e) => { acc[e.event_type] = (acc[e.event_type] || 0) + 1; return acc; }, {})
          ).map(([type, count]) => {
            const cfg = EVENT_CONFIG[type] || DEFAULT_CONFIG;
            const Icon = cfg.icon;
            return (
              <span key={type} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                <Icon className="w-3 h-3" />
                {cfg.label} ({count})
              </span>
            );
          })}
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-muted flex-shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-2 bg-muted rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-destructive text-sm p-4 bg-destructive/10 rounded-lg">{error}</div>
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground">No events recorded yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Events are created automatically when you create deals, receive payments, report issues, and more.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([day, dayEvents]) => (
            <div key={day}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground px-2 whitespace-nowrap">{day}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-1">
                {dayEvents.map(event => {
                  const cfg = EVENT_CONFIG[event.event_type] || DEFAULT_CONFIG;
                  const meta = event.metadata || {};
                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/40 transition-colors group"
                    >
                      <EventIcon eventType={event.event_type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-snug">
                          {event.description || cfg.label}
                        </p>
                        {meta.amount && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {meta.currency || 'UGX'} {Number(meta.amount).toLocaleString()}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                          {event.created_by_name && (
                            <>
                              <span className="text-muted-foreground text-xs">·</span>
                              <span className="text-xs text-muted-foreground">{event.created_by_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity mt-0.5">
                        {timeAgo(event.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pagination.pages > 1 && !filter.includes(',') && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => load(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pagination.pages}
              </span>
              <button
                onClick={() => load(page + 1)}
                disabled={page >= pagination.pages}
                className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
