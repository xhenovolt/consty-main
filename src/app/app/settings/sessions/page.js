'use client';

import { useState, useEffect, useCallback } from 'react';
import { Monitor, Smartphone, Tablet, Laptop, Globe, MapPin, Clock, LogOut, Shield, RefreshCw, AlertCircle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function DeviceIcon({ deviceName, className }) {
  const d = (deviceName || '').toLowerCase();
  if (d.includes('mobile') || d.includes('phone')) return <Smartphone className={className} />;
  if (d.includes('tablet') || d.includes('ipad'))  return <Tablet className={className} />;
  if (d.includes('laptop'))                         return <Laptop className={className} />;
  return <Monitor className={className} />;
}

export default function SessionsPage() {
  const [sessions, setSessions]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [revoking, setRevoking]     = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/auth/sessions');
      if (res.success) setSessions(res.data || []);
    } catch { toast.error('Failed to load sessions'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const revokeSession = async (sessionId) => {
    setRevoking(sessionId);
    try {
      const res = await fetchWithAuth('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (res.success) {
        toast.success('Session revoked');
        load();
      } else {
        toast.error(res.error || 'Failed to revoke session');
      }
    } catch { toast.error('Failed to revoke session'); }
    finally { setRevoking(null); }
  };

  const revokeAll = async () => {
    if (!window.confirm('Sign out of all other devices?')) return;
    setRevoking('all');
    try {
      const res = await fetchWithAuth('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.success) {
        toast.success(res.message || 'All other sessions revoked');
        load();
      } else {
        toast.error(res.error || 'Failed');
      }
    } catch { toast.error('Failed to revoke sessions'); }
    finally { setRevoking(null); }
  };

  const otherSessions = sessions.filter(s => !s.is_current);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" /> Active Sessions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Devices currently signed into your account
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {otherSessions.length > 0 && (
            <button onClick={revokeAll} disabled={!!revoking}
              className="px-3 py-2 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition font-medium disabled:opacity-50 dark:bg-red-900/30 dark:text-red-300">
              Sign out of all other devices
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No active sessions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => (
            <div key={session.id}
              className={`bg-card border rounded-xl p-4 flex items-start gap-4 ${session.is_current ? 'border-blue-500/50 bg-blue-50/30 dark:bg-blue-900/10' : 'border-border'}`}>
              <div className={`p-2.5 rounded-xl shrink-0 ${session.is_current ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-muted'}`}>
                <DeviceIcon
                  deviceName={session.device_name}
                  className={`w-5 h-5 ${session.is_current ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground text-sm">
                    {session.device_name || 'Unknown Device'}
                  </span>
                  {session.is_current && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold">
                      This device
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                  {session.browser && (
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {session.browser}
                    </span>
                  )}
                  {session.os && <span>{session.os}</span>}
                  {session.ip_address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {session.ip_address}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Active {timeAgo(session.last_activity)}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">
                  Started {new Date(session.created_at).toLocaleString()}
                  {session.expires_at && (
                    <> · Expires {new Date(session.expires_at).toLocaleDateString()}</>
                  )}
                </div>
              </div>
              {!session.is_current && (
                <button
                  onClick={() => revokeSession(session.id)}
                  disabled={revoking === session.id || revoking === 'all'}
                  className="shrink-0 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition disabled:opacity-50"
                  title="Revoke this session"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {sessions.length > 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            If you see a session you don&apos;t recognize, sign it out immediately and change your password.
          </p>
        </div>
      )}
    </div>
  );
}
