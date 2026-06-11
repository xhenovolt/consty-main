'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Filter, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const NOTIF_ROUTES = {
  deal: (id) => `/app/deals/${id}`,
  prospect: (id) => `/app/prospects/${id}`,
  client: (id) => `/app/clients/${id}`,
  system: (id) => `/app/systems/${id}`,
  payment: () => '/app/payments',
  operation: () => '/app/operations',
  expense: () => '/app/finance/expenses',
  invoice: (id) => `/app/deals/${id}`,
  employee: () => '/app/hrm',
  license: () => '/app/licenses',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all'); // all | unread
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const toast = useToast();

  const fetchNotifications = useCallback(async () => {
    try {
      let url = `/api/notifications?page=${page}&limit=25`;
      if (filter === 'unread') url += '&unread=true';
      const res = await fetchWithAuth(url);
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data || []);
        setUnreadCount(json.unread_count || 0);
        setPagination(json.pagination || { total: 0, totalPages: 1 });
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [page, filter]);

  useEffect(() => { setLoading(true); fetchNotifications(); }, [fetchNotifications]);

  // Real-time: prepend new notifications
  useRealtimeNotifications({
    onNotification: useCallback((notif) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
    }, []),
    enabled: true,
  });

  const markRead = async (id) => {
    try {
      await fetchWithAuth('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await fetchWithAuth('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch {}
  };

  const getLink = (n) => {
    if (!n.reference_type || !n.reference_id) return null;
    const builder = NOTIF_ROUTES[n.reference_type];
    return builder ? builder(n.reference_id) : null;
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'} &middot; {pagination.total} total
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[{ id: 'all', label: 'All' }, { id: 'unread', label: 'Unread' }].map(f => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${filter === f.id ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            {f.label}
            {f.id === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20">
          <Inbox className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="font-medium text-muted-foreground">{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border divide-y divide-border">
          {notifications.map(n => {
            const link = getLink(n);
            return (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.is_read) markRead(n.id);
                  if (link) window.location.href = link;
                }}
                className={`flex items-start gap-4 p-4 transition-colors ${link ? 'cursor-pointer hover:bg-muted/50' : ''} ${!n.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
              >
                {/* Unread indicator */}
                <div className="mt-2 shrink-0">
                  <div className={`w-2.5 h-2.5 rounded-full ${!n.is_read ? 'bg-blue-500' : 'bg-transparent'}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-medium truncate ${!n.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {n.title}
                    </h3>
                    {n.type && (
                      <span className="px-2 py-0.5 bg-muted rounded text-[10px] font-medium text-muted-foreground uppercase tracking-wide shrink-0">
                        {n.type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  {n.message && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{timeAgo(n.created_at)}</span>
                    {n.actor_name && <span>by {n.actor_name}</span>}
                  </div>
                </div>

                {/* Mark read button */}
                {!n.is_read && (
                  <button
                    onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                    className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition dark:bg-blue-900/30 dark:text-blue-300"
                    title="Mark as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            Page {page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm font-medium transition disabled:opacity-50 hover:bg-muted"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm font-medium transition disabled:opacity-50 hover:bg-muted"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
