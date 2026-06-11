/**
 * lib/presence-tracker.js
 * Track user presence and update last_seen_at when user is active
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export function usePresenceTracker() {
  const [isTracking, setIsTracking] = useState(false);
  const heartbeatTimerRef = useRef(null);
  
  const updatePresence = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          last_seen_at: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        console.warn('Failed to update presence');
      }
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }, []);
  
  const startTracking = useCallback(() => {
    if (isTracking) return;
    
    // Initial update
    updatePresence();
    
    // Set up heartbeat
    heartbeatTimerRef.current = setInterval(updatePresence, HEARTBEAT_INTERVAL);
    setIsTracking(true);
  }, [isTracking, updatePresence]);
  
  const stopTracking = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }
    setIsTracking(false);
  }, []);
  
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);
  
  return {
    isTracking,
    startTracking,
    stopTracking,
    updatePresence
  };
}

export function calculateOnlineStatus(lastSeenAt) {
  if (!lastSeenAt) return 'offline';
  
  const now = new Date();
  const lastSeen = new Date(lastSeenAt);
  const secondsAgo = Math.floor((now - lastSeen) / 1000);
  const minutesAgo = Math.floor(secondsAgo / 60);
  
  if (secondsAgo < 60) return 'online';
  if (minutesAgo <= 5) return 'away';
  return 'offline';
}

export function getStatusColor(status) {
  switch (status) {
    case 'online': return 'bg-green-500';
    case 'away': return 'bg-yellow-500';
    case 'offline': return 'bg-gray-500';
    default: return 'bg-gray-400';
  }
}

export function getStatusLabel(status) {
  switch (status) {
    case 'online': return 'Online';
    case 'away': return 'Away';
    case 'offline': return 'Offline';
    default: return 'Unknown';
  }
}
