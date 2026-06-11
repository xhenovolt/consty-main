/**
 * PasswordVerificationModal
 * 
 * Modal for confirming password before viewing/rotating secrets
 * Part of Phase 2-3: Secure secret viewing
 */

'use client';

import { useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import toast from 'react-hot-toast';

export default function PasswordVerificationModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Confirm Password',
  description = 'Enter your password to access sensitive credentials',
  actionText = 'Verify',
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/integrations/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Password verification failed');
      }

      // Success - return token to parent
      onSuccess(result.token, result.expiresIn);
      setPassword('');
      setError('');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          {title}
        </AlertDialogTitle>

        <AlertDialogDescription>
          {description}
        </AlertDialogDescription>

        <div className="space-y-4 my-4">
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-300">
            <strong>⚠️ Security Notice:</strong> API keys and secrets are sensitive. Never share them.
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    handleSubmit();
                  }
                }}
                placeholder="Enter your password"
                className="w-full px-3 py-2 border rounded-lg text-sm"
                disabled={loading}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
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
              handleSubmit();
            }}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : actionText}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
