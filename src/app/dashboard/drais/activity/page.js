'use client';

/**
 * DRAIS Activity Monitoring Dashboard
 * 
 * Shows what schools are doing in real-time
 * Tracks user actions, logins, usage patterns
 */

import { useState, useEffect } from 'react';
import { RefreshCw, Activity, Clock, User, Zap } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useDRAISAuditLogs, useDRAISSchools } from '@/hooks/useDRAISSchools';
import DRAISStatusIndicator from '@/components/drais/DRAISStatusIndicator';

export default function ActivityMonitoringDashboard() {
  const { showToast } = useToast();
  const [range, setRange] = useState('24h');
  const [selectedSchool, setSelectedSchool] = useState(null);
  
  const { logs, loading, error, mutate } = useDRAISAuditLogs(range, selectedSchool);
  const { schools } = useDRAISSchools();

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      mutate();
    }, 10000);
    return () => clearInterval(interval);
  }, [mutate]);

  const handleRefresh = async () => {
    await mutate();
    showToast('Activity logs refreshed', 'success');
  };

  const activityCount = logs?.length || 0;

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Activity Monitor</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time tracking of what schools are doing</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* ─── ACTIVITY STATS ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {range === '1h' ? 'Last Hour' : range === '7d' ? 'Last 7 Days' : 'Last 24 Hours'}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{activityCount}</p>
            </div>
            <Zap className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Schools in View</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedSchool ? '1' : schools?.length || '—'}
              </p>
            </div>
            <Activity className="text-green-500" size={24} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <DRAISStatusIndicator />
        </div>
      </div>

      {/* ─── FILTERS ────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Time Range
            </label>
            <div className="flex gap-2">
              {['1h', '24h', '7d'].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    range === r
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {r === '1h' ? 'Last Hour' : r === '7d' ? 'Last 7 Days' : 'Last 24 Hours'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              School
            </label>
            <select
              value={selectedSchool || ''}
              onChange={(e) => setSelectedSchool(e.target.value || null)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-gray-900 dark:text-white"
            >
              <option value="">All Schools</option>
              {schools?.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── ACTIVITY LOG TABLE ───────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading activity logs...</div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-600 dark:text-red-400 mb-2">{error}</p>
            <button
              onClick={handleRefresh}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  School
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  User
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {!logs || logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    No activities recorded for the selected time range
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr
                    key={log.id || idx}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock size={14} />
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {log.school_name}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <User size={14} />
                        {log.user_email || log.user_id || 'System'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {JSON.stringify(log.metadata).substring(0, 50)}...
                        </code>
                      ) : (
                        '—'
                      )}
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
          <strong>Auto-refreshing every 10 seconds.</strong> Activity logs show user actions,
          system events, and important school status changes captured from DRAIS.
        </div>
      </div>
    </div>
  );
}

/**
 * ActionBadge — color-coded action display
 */
function ActionBadge({ action }) {
  const actionColors = {
    login: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-200', label: action },
    logout: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-200', label: action },
    create: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-200', label: action },
    update: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-200', label: action },
    delete: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-200', label: action },
    suspend: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-200', label: action },
    activate: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-200', label: action },
  };

  const config = actionColors[action?.toLowerCase()] || {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-800 dark:text-gray-200',
    label: action || 'Unknown',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}
