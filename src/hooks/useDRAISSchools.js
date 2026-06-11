'use client';

/**
 * useDRAISSchools Hook
 * 
 * Fetches schools from DRAIS API via secure proxy with real-time polling
 * Provides automatic refresh, error handling, and data revalidation
 * 
 * Uses /api/drais-proxy for secure server-side credential handling
 */

import { useState, useEffect, useCallback } from 'react';

const POLLING_INTERVAL = 15000; // 15 seconds

export function useDRAISSchools() {
  const [schools, setSchools] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  // Fetch schools from the proxy
  const fetchSchools = useCallback(async () => {
    try {
      setError(null); // Clear previous errors
      setIsValidating(true);

      const response = await fetch('/api/drais-proxy?action=getSchools', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error || errorData?.message || `HTTP ${response.status}`
        );
      }

      const data = await response.json();

      if (data.success === false) {
        throw new Error(data.error || 'Failed to fetch schools');
      }

      // Handle both direct data (array) and wrapped response
      setSchools(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('[DRAIS Schools] Fetch error:', message);
    } finally {
      setLoading(false);
      setIsValidating(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  // Auto-refresh polling
  useEffect(() => {
    const interval = setInterval(fetchSchools, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchSchools]);

  return {
    schools,
    loading,
    error,
    isValidating,
    mutate: fetchSchools,
  };
}

/**
 * useDRAISSchool Hook
 * 
 * Fetches a single school by ID
 */
export function useDRAISSchool(schoolId) {
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(!schoolId);
  const [error, setError] = useState(null);

  const fetchSchool = useCallback(async () => {
    if (!schoolId) return;

    try {
      setError(null);
      const response = await fetch(`/api/drais/schools/${schoolId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setSchool(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch school');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchSchool();
  }, [fetchSchool]);

  return { school, loading, error, mutate: fetchSchool };
}

/**
 * useDRAISAuditLogs Hook
 * 
 * Fetches audit logs from DRAIS
 */
export function useDRAISAuditLogs(range = '24h', schoolId = null) {
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLogs = useCallback(async () => {
    try {
      setError(null);

      const params = new URLSearchParams();
      params.append('range', range);
      if (schoolId) params.append('school_id', schoolId);

      const response = await fetch(`/api/drais/audit-logs?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setLogs(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch audit logs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [range, schoolId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  return { logs, loading, error, mutate: fetchLogs };
}

/**
 * useDRAISPricing Hook
 * 
 * Fetches pricing configuration
 */
export function useDRAISPricing(includeInactive = false) {
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPricing = useCallback(async () => {
    try {
      setError(null);

      const params = new URLSearchParams();
      if (includeInactive) params.append('include_inactive', 'true');

      const response = await fetch(`/api/drais/pricing?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setPricing(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch pricing');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  return { pricing, loading, error, mutate: fetchPricing };
}

/**
 * useDRAISHealth Hook
 * 
 * Checks DRAIS API health
 */
export function useDRAISHealth() {
  const [status, setStatus] = useState(null);
  const [isHealthy, setIsHealthy] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/drais/health', {
          credentials: 'include',
        });
        const data = await response.json();
        setStatus(data.status);
        setIsHealthy(data.success && data.status === 'ok');
      } catch (err) {
        setIsHealthy(false);
        setStatus('unknown');
      }
    };

    checkHealth();

    // Check every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return { status, isHealthy };
}
