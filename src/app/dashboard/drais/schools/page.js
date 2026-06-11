'use client';

/**
 * DRAIS Schools Control Dashboard
 * 
 * Real-time command center for school management
 * Shows live data from DRAIS and enables control actions
 * 
 * Design Principle: This is NOT a dashboard, it's a COMMAND CENTER
 * 
 * Phase 8: Includes connection selector
 * Phase 9: Wrapped with failsafe for connection checking
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, Power, CheckCircle, Clock, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useDRAISSchools } from '@/hooks/useDRAISSchools';
import SchoolActionButtons from '@/components/drais/SchoolActionButtons';
import DRAISStatusIndicator from '@/components/drais/DRAISStatusIndicator';
import DRAISConnectionSelector from '@/components/drais/DRAISConnectionSelector';
import DRAISConnectionFailsafe from '@/components/drais/DRAISConnectionFailsafe';
import ErrorFallback from '@/components/drais/ErrorFallback';

function SchoolsControlContent() {
  const { showToast } = useToast();
  const { schools, loading, error, mutate, isValidating } = useDRAISSchools();
  const [selectedSchools, setSelectedSchools] = useState(new Set());
  const [filterStatus, setFilterStatus] = useState(null);
  const [sortBy, setSortBy] = useState('name');

  // Auto-refresh every 15 seconds for real-time visibility
  useEffect(() => {
    const interval = setInterval(() => {
      mutate();
    }, 15000);
    return () => clearInterval(interval);
  }, [mutate]);

  const handleRefresh = async () => {
    await mutate();
    showToast('Schools refreshed', 'success');
  };

  const filteredSchools = schools
    ?.filter((school) => !filterStatus || school.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      if (sortBy === 'created') return new Date(b.created_at) - new Date(a.created_at);
      return 0;
    });

  const activeCount = schools?.filter((s) => s.status === 'active').length || 0;
  const suspendedCount = schools?.filter((s) => s.status === 'suspended').length || 0;

  // Show error state
  if (error) {
    return <ErrorFallback error={error} onRetry={handleRefresh} />;
  }

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Schools Control</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Live system status from DRAIS</p>
        </div>
        <div className="flex gap-4 items-start">
          <DRAISConnectionSelector />
          <button
            onClick={handleRefresh}
            disabled={isValidating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition"
          >
            <RefreshCw size={16} className={isValidating ? 'animate-spin' : ''} />
            {isValidating ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* ─── STATUS CARDS ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Schools</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {loading ? '—' : schools?.length || 0}
              </p>
            </div>
            <CheckCircle className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activeCount}</p>
            </div>
            <Power className="text-green-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Suspended</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{suspendedCount}</p>
            </div>
            <AlertTriangle className="text-red-500" size={24} />
          </div>
        </div>
      </div>

      {/* ─── CONTROLS ────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <select
            value={filterStatus || ''}
            onChange={(e) => setFilterStatus(e.target.value || null)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-gray-900 dark:text-white"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-gray-900 dark:text-white"
          >
            <option value="name">Sort by Name</option>
            <option value="status">Sort by Status</option>
            <option value="created">Sort by Created</option>
          </select>
        </div>

        <DRAISStatusIndicator />
      </div>

      {/* ─── TABLE ────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading && !schools ? (
          <div className="p-8 text-center text-gray-500">Loading schools...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  School Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  External ID
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Last Activity
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {!filteredSchools || filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No schools found
                  </td>
                </tr>
              ) : (
                filteredSchools.map((school) => (
                  <tr
                    key={school.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {school.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {school.external_id}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <StatusBadge status={school.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(school.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {school.last_activity ? (
                        new Date(school.last_activity).toLocaleString()
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <SchoolActionButtons
                        school={school}
                        onMutate={mutate}
                        onError={(err) => showToast(err, 'error')}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── INFO BOX ─────────────────────────────────────────────────────── */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3">
        <Clock className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-blue-900 dark:text-blue-200">
          <strong>Auto-refreshing every 15 seconds.</strong> You're seeing live data from DRAIS.
          Click Refresh Now for immediate updates.
        </div>
      </div>
    </div>
  );
}

/**
 * Status badge component
 */
function StatusBadge({ status }) {
  const config = {
    active: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-200', label: 'Active' },
    suspended: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-200', label: 'Suspended' },
    inactive: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-200', label: 'Inactive' },
  };

  const { bg, text, label } = config[status] || config.inactive;

  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>{label}</span>;
}

/**
 * Main export with failsafe wrapper
 * Phase 9: Ensures active connection exists before rendering
 */
export default function SchoolsControlDashboard() {
  return (
    <DRAISConnectionFailsafe>
      <SchoolsControlContent />
    </DRAISConnectionFailsafe>
  );
}
