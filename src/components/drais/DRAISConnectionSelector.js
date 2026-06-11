/**
 * DRAISConnectionSelector
 * 
 * Dropdown to view and switch active DRAIS connections
 * Part of Phase 8: Connection selection UI
 */

'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DRAISConnectionSelector() {
  const [connections, setConnections] = useState([]);
  const [activeConnection, setActiveConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadConnections();
    // Refresh every 30 seconds to detect external changes
    const interval = setInterval(loadConnections, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadConnections() {
    try {
      setLoading(true);
      const response = await fetch('/api/integrations/connections');
      if (!response.ok) throw new Error('Failed to load connections');

      const data = await response.json();
      const conns = data.data || [];
      
      setConnections(conns);
      
      // Find active connection
      const active = conns.find((c) => c.is_active);
      setActiveConnection(active || null);
    } catch (error) {
      console.error('Failed to load connections:', error);
      // Don't toast errors here - let the page handle it
    } finally {
      setLoading(false);
    }
  }

  async function switchConnection(connectionId) {
    try {
      // Deactivate all, then activate selected
      const response = await fetch(`/api/integrations/connections/${connectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      });

      if (!response.ok) throw new Error('Failed to switch connection');

      toast.success('Connection switched');
      setOpen(false);
      loadConnections();
    } catch (error) {
      console.error('Failed to switch connection:', error);
      toast.error('Failed to switch connection');
    }
  }

  if (loading) {
    return null;
  }

  const draclConnections = connections.filter((c) => c.system_type === 'drais');

  if (draclConnections.length === 0) {
    return (
      <div className="px-4 py-2 text-xs bg-red-50 border border-red-200 rounded text-red-700 flex gap-2 items-center dark:bg-red-900/30 dark:text-red-300">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span>No DRAIS connections configured. Go to Integrations to add one.</span>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50"
      >
        <div className="flex flex-col items-start">
          <span className="text-xs text-gray-600">Active Connection:</span>
          <span className="font-semibold">{activeConnection?.name || 'None'}</span>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 w-72 bg-white border rounded-lg shadow-lg z-50">
          <div className="p-3 border-b bg-gray-50">
            <h3 className="font-semibold text-sm">DRAIS Connections</h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {draclConnections.map((conn) => (
              <button
                key={conn.id}
                onClick={() => switchConnection(conn.id)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-blue-50 transition ${
                  activeConnection?.id === conn.id ? 'bg-blue-100 font-semibold' : ''
                } dark:hover:bg-blue-900/20`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{conn.name}</p>
                    <p className="text-xs text-gray-600 mt-1">{conn.base_url}</p>
                    {conn.description && (
                      <p className="text-xs text-gray-500 mt-1">{conn.description}</p>
                    )}
                  </div>
                  {activeConnection?.id === conn.id && (
                    <div className="flex-shrink-0 ml-2">
                      <div className="w-2 h-2 rounded-full bg-green-600 mt-1"></div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="p-3 border-t bg-gray-50 text-center">
            <a
              href="/app/dashboard/integrations"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Manage Connections
            </a>
          </div>
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
