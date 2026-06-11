'use client';
/**
 * useHeartbeat - Client-side presence heartbeat
 *
 * Pings POST /api/presence/ping every 30s while the tab is active.
 * Pauses on tab hidden, resumes on visibility.
 *
 * Status thresholds (mirrors server):
 *   online:  last_ping < 60 seconds
 *   away:    last_ping between 60s and 5 minutes
 *   offline: last_ping > 5 minutes
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const PING_INTERVAL_MS = 30_000;

export function useHeartbeat() {
  const intervalRef = useRef(null);
  const pathname = usePathname();

  const ping = async () => {
    try {
      const pageTitle = typeof document !== 'undefined' ? document.title : '';
      await fetch('/api/presence/ping', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: pathname, page_title: pageTitle }),
      });
    } catch {
      // Network error — silently ignore, will retry on next tick
    }
  };

  const start = () => {
    if (intervalRef.current) return;
    ping();
    intervalRef.current = setInterval(ping, PING_INTERVAL_MS);
  };

  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!document.hidden) start();

    const handleVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}

/**
 * Compute presence status from a last_seen timestamp (client-side).
 * Mirrors the server-side CASE expression exactly.
 */
export function getPresenceStatus(lastSeen) {
  if (!lastSeen) return 'offline';
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  if (diffMs < 60_000)       return 'online';   // < 60 seconds
  if (diffMs < 5 * 60_000)   return 'away';     // 60s – 5 minutes
  return 'offline';
}

/** Human-readable last_seen string */
export function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Never';
  const diff = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000);
  if (diff < 30)    return 'Just now';
  if (diff < 60)    return 'Less than a minute ago';
  if (diff < 120)   return '1 minute ago';
  if (diff < 3600)  return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 7200)  return '1 hour ago';
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

/**
 * Inline presence dot indicator.
 *   online  → green pulsing dot
 *   away    → amber static dot
 *   offline → grey static dot
 *
 * Usage: <PresenceDot status="away" lastSeen={ts} showLabel />
 */
export function PresenceDot({ status, lastSeen, showLabel = false }) {
  const config = {
    online:  { dot: 'bg-green-500 animate-pulse', label: 'Online',                              color: '#22c55e' },
    away:    { dot: 'bg-amber-400',               label: 'Away',                               color: '#f59e0b' },
    offline: { dot: 'bg-gray-400',                label: `Last seen ${formatLastSeen(lastSeen)}`, color: '#9ca3af' },
  };
  const { dot, label, color } = config[status] || config.offline;

  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
      {showLabel && (
        <span className="text-xs" style={{ color }}>
          {label}
        </span>
      )}
    </span>
  );
}
