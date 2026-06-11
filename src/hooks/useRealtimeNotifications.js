'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useRealtimeNotifications — SSE hook for real-time notification delivery
 * Falls back to polling if SSE connection fails.
 *
 * @param {object} options
 * @param {function} options.onNotification - Called with notification payload when received
 * @param {boolean} [options.enabled=true] - Whether to connect
 * @param {number} [options.pollingInterval=30000] - Fallback polling interval in ms
 * @returns {{ connected: boolean, error: string|null }}
 */
export function useRealtimeNotifications({ onNotification, enabled = true, pollingInterval = 30000 } = {}) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const onNotificationRef = useRef(onNotification);

  // Keep callback ref updated
  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  const connect = useCallback(() => {
    if (!enabled) return;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const es = new EventSource('/api/notifications/stream', { withCredentials: true });
      eventSourceRef.current = es;

      es.addEventListener('connected', () => {
        setConnected(true);
        setError(null);
        retryCountRef.current = 0;
      });

      es.addEventListener('notification', (event) => {
        try {
          const data = JSON.parse(event.data);
          onNotificationRef.current?.(data);
        } catch {}
      });

      es.addEventListener('error', (event) => {
        try {
          const data = JSON.parse(event.data);
          setError(data.message);
        } catch {}
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        eventSourceRef.current = null;

        // Exponential backoff reconnect: 2s, 4s, 8s, 16s, max 60s
        const delay = Math.min(2000 * Math.pow(2, retryCountRef.current), 60000);
        retryCountRef.current++;

        if (retryCountRef.current <= 10) {
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          setError('Connection lost — falling back to polling');
        }
      };
    } catch {
      setError('SSE not supported');
    }
  }, [enabled]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { connected, error };
}
