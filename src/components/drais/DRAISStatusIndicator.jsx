'use client';

/**
 * DRAISStatusIndicator
 * 
 * Shows DRAIS API health status
 * Green dot = connected, Red dot = error
 */

import { useDRAISHealth } from '@/hooks/useDRAISSchools';
import { CheckCircle, AlertCircle } from 'lucide-react';

export default function DRAISStatusIndicator() {
  const { isHealthy, status } = useDRAISHealth();

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
      {isHealthy ? (
        <>
          <CheckCircle size={16} className="text-green-600 dark:text-green-400 animate-pulse" />
          <span className="text-sm font-medium text-green-600 dark:text-green-400">DRAIS Connected</span>
        </>
      ) : (
        <>
          <AlertCircle size={16} className="text-red-600 dark:text-red-400 animate-pulse" />
          <span className="text-sm font-medium text-red-600 dark:text-red-400">
            DRAIS {status === 'unknown' ? 'Unknown' : 'Disconnected'}
          </span>
        </>
      )}
    </div>
  );
}
