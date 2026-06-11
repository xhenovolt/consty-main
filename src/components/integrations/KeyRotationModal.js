/**
 * KeyRotationModal
 * 
 * Modal for rotating API keys/secrets
 * Supports auto-generate and manual input modes
 * Part of Phase 4: Key Rotation
 */

'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function KeyRotationModal({
  isOpen,
  onClose,
  onSuccess,
  connectionId,
  connectionName,
  verificationToken,
}) {
  const [mode, setMode] = useState('auto'); // 'auto' or 'manual'
  const [manualKey, setManualKey] = useState('');
  const [manualSecret, setManualSecret] = useState('');
  const [revokeOld, setRevokeOld] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRotate = async () => {
    setError('');
    setLoading(true);

    try {
      if (mode === 'manual' && (!manualKey || !manualSecret)) {
        throw new Error('Both API key and secret must be provided');
      }

      const response = await fetch(
        `/api/integrations/${connectionId}/rotate-keys`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: verificationToken,
            mode,
            new_api_key: mode === 'auto' ? undefined : manualKey,
            new_api_secret: mode === 'auto' ? undefined : manualSecret,
            revoke_old_immediately: revokeOld,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Key rotation failed');
      }

      toast.success(result.message);
      
      // Clear form
      setManualKey('');
      setManualSecret('');
      setMode('auto');
      setRevokeOld(false);
      
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rotation failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Rotate API Keys
        </AlertDialogTitle>

        <AlertDialogDescription>
          Rotate keys for <strong>{connectionName}</strong>
        </AlertDialogDescription>

        <div className="space-y-4 my-4">
          {/* Mode Selection */}
          <div>
            <label className="text-sm font-semibold mb-2 block">
              Rotation Mode
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                style={{ borderColor: mode === 'auto' ? '#3b82f6' : '#e5e7eb' }}
              >
                <input
                  type="radio"
                  value="auto"
                  checked={mode === 'auto'}
                  onChange={(e) => setMode(e.target.value)}
                  disabled={loading}
                />
                <span className="text-sm">
                  <strong>Auto-Generate</strong> (Recommended)
                  <p className="text-xs text-gray-600 mt-1">
                    System generates secure random keys
                  </p>
                </span>
              </label>

              <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                style={{ borderColor: mode === 'manual' ? '#3b82f6' : '#e5e7eb' }}
              >
                <input
                  type="radio"
                  value="manual"
                  checked={mode === 'manual'}
                  onChange={(e) => setMode(e.target.value)}
                  disabled={loading}
                />
                <span className="text-sm">
                  <strong>Manual Input</strong>
                  <p className="text-xs text-gray-600 mt-1">
                    Paste existing keys from provider
                  </p>
                </span>
              </label>
            </div>
          </div>

          {/* Manual Input Fields */}
          {mode === 'manual' && (
            <div className="space-y-3 p-3 bg-gray-50 rounded border">
              <div>
                <label className="text-xs font-semibold block mb-1">
                  New API Key
                </label>
                <input
                  type="text"
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                  placeholder="sk_..."
                  className="w-full px-2 py-1 text-sm border rounded"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">
                  New API Secret
                </label>
                <input
                  type="text"
                  value={manualSecret}
                  onChange={(e) => setManualSecret(e.target.value)}
                  placeholder="ss_..."
                  className="w-full px-2 py-1 text-sm border rounded"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* Revoke Old Keys Option */}
          <label className="flex items-center gap-2 p-2 border rounded bg-amber-50 border-amber-200 cursor-pointer">
            <input
              type="checkbox"
              checked={revokeOld}
              onChange={(e) => setRevokeOld(e.target.checked)}
              disabled={loading}
            />
            <span className="text-sm">
              <strong>Revoke old keys immediately</strong>
              <p className="text-xs text-amber-700 mt-1">
                Invalidate previous credentials after sync
              </p>
            </span>
          </label>

          {/* Warning */}
          <div className="bg-red-50 border border-red-200 rounded p-3 flex gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-700">
              <strong>Rotation will:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Update keys in CONSTY</li>
                <li>Sync with external systems</li>
                <li>Log all changes for audit</li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-300 rounded p-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <AlertDialogCancel disabled={loading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleRotate();
            }}
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? 'Rotating...' : 'Rotate Keys'}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
