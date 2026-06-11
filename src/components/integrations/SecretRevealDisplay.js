/**
 * SecretRevealDisplay
 * 
 * Shows decrypted API key/secret with timer
 * Auto-hides after 15 seconds
 * Part of Phase 3: Temporary Reveal
 */

'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Copy, Eye, EyeOff, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SecretRevealDisplay({ 
  connectionName, 
  apiKey, 
  apiSecret, 
  onHide,
  mutableDuration = 15 // seconds
}) {
  const [timeLeft, setTimeLeft] = useState(mutableDuration);
  const [showKey, setShowKey] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-hide timer
  useEffect(() => {
    if (timeLeft <= 0) {
      onHide();
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, onHide]);

  const copyToClipboard = (value, name) => {
    navigator.clipboard.writeText(value);
    toast.success(`${name} copied to clipboard`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
      {/* Warning Banner */}
      <div className="flex gap-3 items-start bg-red-100 rounded p-3">
        <AlertCircle className="h-5 w-5 text-red-700 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-red-800">
          <strong>⚠️ SENSITIVE CREDENTIALS VISIBLE</strong>
          <p className="mt-1">These secrets will auto-hide in {timeLeft} seconds</p>
          <p className="text-xs mt-1 opacity-80">Never share these with anyone. Do not take screenshots.</p>
        </div>
      </div>

      {/* Timer Display */}
      <div className="flex items-center gap-2 text-sm font-mono">
        <Clock className="h-4 w-4 text-red-600 animate-pulse" />
        <span className="text-red-700 font-bold">
          Auto-hiding in {timeLeft}s
        </span>
      </div>

      {/* API Key */}
      <div>
        <label className="text-xs font-semibold text-gray-700 uppercase">
          API KEY
        </label>
        <div className="flex items-center gap-2 mt-1">
          <code className="flex-1 bg-white border rounded px-3 py-2 text-sm font-mono overflow-auto max-h-20">
            {showKey ? apiKey : apiKey.substring(0, 4) + '****'}
          </code>
          <button
            onClick={() => setShowKey(!showKey)}
            className="p-2 hover:bg-white rounded transition"
            title={showKey ? 'Hide' : 'Show'}
          >
            {showKey ? (
              <EyeOff className="h-4 w-4 text-gray-600" />
            ) : (
              <Eye className="h-4 w-4 text-gray-600" />
            )}
          </button>
          {showKey && (
            <button
              onClick={() => copyToClipboard(apiKey, 'API Key')}
              className="p-2 hover:bg-white rounded transition"
              title="Copy to clipboard"
            >
              <Copy className="h-4 w-4 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* API Secret */}
      <div>
        <label className="text-xs font-semibold text-gray-700 uppercase">
          API SECRET
        </label>
        <div className="flex items-center gap-2 mt-1">
          <code className="flex-1 bg-white border rounded px-3 py-2 text-sm font-mono overflow-auto max-h-20">
            {showSecret ? apiSecret : apiSecret.substring(0, 4) + '****'}
          </code>
          <button
            onClick={() => setShowSecret(!showSecret)}
            className="p-2 hover:bg-white rounded transition"
            title={showSecret ? 'Hide' : 'Show'}
          >
            {showSecret ? (
              <EyeOff className="h-4 w-4 text-gray-600" />
            ) : (
              <Eye className="h-4 w-4 text-gray-600" />
            )}
          </button>
          {showSecret && (
            <button
              onClick={() => copyToClipboard(apiSecret, 'API Secret')}
              className="p-2 hover:bg-white rounded transition"
              title="Copy to clipboard"
            >
              <Copy className="h-4 w-4 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-gray-600 space-y-1">
        <p>✓ Credentials will not appear in browser history or console logs</p>
        <p>✓ This view is temporary and single-use</p>
        <p>✓ All access is logged for security audit</p>
      </div>

      <button
        onClick={onHide}
        className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium text-sm"
      >
        Hide Secrets Now
      </button>
    </div>
  );
}
