/**
 * DRAISConnectionFailsafe
 * 
 * Ensures an active DRAIS connection exists before allowing access
 * Shows helpful error message if no connection is configured
 * Part of Phase 9: Failsafe system
 */

'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DRAISConnectionFailsafe({ children }) {
  const [hasConnection, setHasConnection] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConnection();
    // Recheck every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  async function checkConnection() {
    try {
      const response = await fetch('/api/integrations/connections');
      if (!response.ok) throw new Error('Failed to check connection');

      const data = await response.json();
      const connections = data.data || [];
      const activeConnection = connections.find(
        (c) => c.system_type === 'drais' && c.is_active
      );

      setHasConnection(!!activeConnection);
    } catch (error) {
      console.error('Failed to check connection:', error);
      // Assume no connection on error
      setHasConnection(false);
    } finally {
      setLoading(false);
    }
  }

  // Still loading
  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="inline-block">
          <div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
        </div>
        <p className="mt-4">Checking connection status...</p>
      </div>
    );
  }

  // No active connection - show failsafe UI
  if (!hasConnection) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 space-y-4">
          <div className="flex gap-3 items-start">
            <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-bold text-red-900">
                No Active DRAIS Connection
              </h2>
              <p className="text-sm text-red-800 mt-2">
                This DRAIS feature requires an active external connection. Please
                configure one in the Integrations section.
              </p>
            </div>
          </div>

          <div className="bg-white rounded p-4 text-sm text-gray-700 space-y-2">
            <p className="font-semibold">How to fix this:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Go to Dashboard → DRAIS Control → Integrations</li>
              <li>Click "New Connection"</li>
              <li>Enter your DRAIS API credentials</li>
              <li>Click "Test Connection" to verify</li>
              <li>Set as Active</li>
            </ol>
          </div>

          <Button
            onClick={() => {
              window.location.href = '/app/dashboard/integrations';
            }}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            Configure Connection Now
          </Button>
        </div>
      </div>
    );
  }

  // Connection exists - render children
  return children;
}
