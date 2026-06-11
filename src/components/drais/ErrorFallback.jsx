'use client';

/**
 * ErrorFallback
 * 
 * Displays when DRAIS APIs are unavailable
 * Shows user that live data cannot be fetched
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorFallback({ error, onRetry }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-6 rounded">
        <div className="flex gap-4">
          <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={24} />
          <div>
            <h2 className="text-lg font-bold text-red-900 dark:text-red-200 mb-2">
              Unable to fetch live data from DRAIS
            </h2>
            <p className="text-red-800 dark:text-red-300 mb-4">
              {error || 'The DRAIS API is currently unavailable. This could be due to:'}
            </p>
            <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1 mb-4">
              <li>Network connectivity issues</li>
              <li>DRAIS API server is down</li>
              <li>API credentials are invalid</li>
              <li>Firewall or security group restrictions</li>
            </ul>
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
            >
              <RefreshCw size={16} />
              Try Again
            </button>
          </div>
        </div>
      </div>

      {/* Verification Checklist */}
      <div className="mt-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">Troubleshooting Checklist</h3>
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex gap-3">
            <span className="text-gray-400">1.</span>
            <span>Verify <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">DRAIS_API_BASE_URL</code> is set in .env</span>
          </div>
          <div className="flex gap-3">
            <span className="text-gray-400">2.</span>
            <span>Check <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">DRAIS_API_KEY</code> and <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">DRAIS_API_SECRET</code> are valid</span>
          </div>
          <div className="flex gap-3">
            <span className="text-gray-400">3.</span>
            <span>Verify DRAIS server is running and accessible</span>
          </div>
          <div className="flex gap-3">
            <span className="text-gray-400">4.</span>
            <span>Check server logs for detailed error messages</span>
          </div>
        </div>
      </div>
    </div>
  );
}
