'use client';

/**
 * useDRAISNotifications Hook
 * 
 * Polls for important DRAIS events:
 * - New schools created
 * - Schools suspended
 * - High activity spikes
 * 
 * Shows toast notifications for command center awareness
 */

import { useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/Toast';

const POLL_INTERVAL = 30000; // 30 seconds

export function useDRAISNotifications(enabled = true) {
  const { showToast } = useToast();
  const previousStateRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const checkForEvents = async () => {
      try {
        // Fetch schools to detect new ones or status changes
        const schoolsResponse = await fetch('/api/drais/schools', {
          credentials: 'include',
        });

        if (!schoolsResponse.ok) return;

        const schoolsData = await schoolsResponse.json();
        if (!schoolsData.success) return;

        const currentSchools = schoolsData.data || [];
        const previous = previousStateRef.current || { schools: [], suspendedCount: 0 };

        // Check for newly created schools
        const newSchools = currentSchools.filter(
          (s) => !previous.schools.find((ps) => ps.id === s.id)
        );

        newSchools.forEach((school) => {
          showToast(`New School Onboarded: ${school.name}`, 'success', Infinity);
        });

        // Check for newly suspended schools
        const nowSuspended = currentSchools.filter(
          (s) => s.status === 'suspended' && previous.schools.find((ps) => ps.id === s.id && ps.status !== 'suspended')
        );

        nowSuspended.forEach((school) => {
          showToast(`⚠️ School Suspended: ${school.name}`, 'warning', Infinity);
        });

        // Check for newly activated schools
        const nowActive = currentSchools.filter(
          (s) => s.status === 'active' && previous.schools.find((ps) => ps.id === s.id && ps.status === 'suspended')
        );

        nowActive.forEach((school) => {
          showToast(`School Reactivated: ${school.name}`, 'info');
        });

        // Update state
        previousStateRef.current = {
          schools: currentSchools,
          suspendedCount: currentSchools.filter((s) => s.status === 'suspended').length,
        };
      } catch (err) {
        console.error('[DRAIS Notifications] Error:', err);
      }
    };

    // Initial check
    checkForEvents();

    // Set up polling
    const interval = setInterval(checkForEvents, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [enabled, showToast]);

  return null; // Hook doesn't return anything, just manages side effects
}

/**
 * useActivityAlert Hook
 * 
 * Shows alerts for high activity spikes in specific schools
 */
export function useActivityAlert(schoolId = null, threshold = 10) {
  const { showToast } = useToast();
  const lastCountRef = useRef(0);

  useEffect(() => {
    const checkActivity = async () => {
      try {
        const params = new URLSearchParams();
        params.append('range', '1h');
        if (schoolId) params.append('school_id', schoolId);

        const response = await fetch(`/api/drais/audit-logs?${params}`, {
          credentials: 'include',
        });

        if (!response.ok) return;

        const data = await response.json();
        if (!data.success) return;

        const currentCount = data.data?.length || 0;
        const lastCount = lastCountRef.current;

        // Alert if activity spike detected
        if (currentCount > threshold && lastCount <= threshold) {
          const schoolName = schoolId
            ? `in selected school`
            : `across DRAIS`;

          showToast(
            `High activity spike detected ${schoolName}! (${currentCount} events in last hour)`,
            'warning'
          );
        }

        lastCountRef.current = currentCount;
      } catch (err) {
        console.error('[Activity Alert] Error:', err);
      }
    };

    // Check every 60 seconds
    const interval = setInterval(checkActivity, 60000);
    return () => clearInterval(interval);
  }, [schoolId, threshold, showToast]);

  return null;
}
