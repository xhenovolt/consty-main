'use client';

/**
 * SchoolActionButtons
 * 
 * Render suspend/activate buttons for a school
 * Color-coded for clarity: Red = destructive, Green = activate
 */

import { useState } from 'react';
import { Power, PowerOff, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export default function SchoolActionButtons({ school, onMutate, onError }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSuspend = async () => {
    // Confirm before destructive action
    if (!window.confirm(`Are you sure you want to suspend "${school.name}"?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/drais-proxy?action=suspendSchool&id=${school.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success === false) {
        throw new Error(data.error || 'Failed to suspend school');
      }

      showToast(`"${school.name}" suspended`, 'success');
      onMutate?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/drais-proxy?action=activateSchool&id=${school.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success === false) {
        throw new Error(data.error || 'Failed to activate school');
      }

      showToast(`"${school.name}" activated`, 'success');
      onMutate?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      {school.status === 'active' ? (
        <button
          onClick={handleSuspend}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded transition"
          title="Suspend this school"
        >
          <PowerOff size={14} />
          Suspend
        </button>
      ) : (
        <button
          onClick={handleActivate}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded transition"
          title="Activate this school"
        >
          <Power size={14} />
          Activate
        </button>
      )}

      <a
        href={`/dashboard/drais/schools/${school.id}`}
        className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
        title="View details"
      >
        View
      </a>
    </div>
  );
}
