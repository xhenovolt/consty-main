/**
 * SecureConnectionCard
 * 
 * Enhanced connection card with:
 * - View Secrets button (with password confirmation)
 * - Rotate Keys button
 * - Security warnings
 * - Masked credential display
 */

'use client';

import { useState } from 'react';
import { Eye, RotateCw, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PasswordVerificationModal from './PasswordVerificationModal';
import SecretRevealDisplay from './SecretRevealDisplay';
import KeyRotationModal from './KeyRotationModal';
import toast from 'react-hot-toast';

export default function SecureConnectionCard({
  connection,
  onDelete,
  onToggleActive,
  onRefresh,
}) {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [decryptedSecrets, setDecryptedSecrets] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Handle password verification success
  const handlePasswordVerified = async (token, expiresIn) => {
    setVerificationToken(token);

    // Fetch decrypted secrets
    try {
      const response = await fetch(
        `/api/integrations/${connection.id}/secrets?token=${token}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch secrets');
      }

      const result = await response.json();
      setDecryptedSecrets(result.data);
      setShowSecrets(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve secrets';
      toast.error(msg);
    }
  };

  const handleDeleteConnection = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/integrations/connections/${connection.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete connection');
      }

      toast.success('Connection deleted');
      onDelete?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className={`border-2 rounded-lg p-6 transition ${
        connection.is_active
          ? 'bg-green-50 border-green-300'
          : 'bg-gray-50 border-gray-300'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-bold text-lg">{connection.name}</h3>
            {connection.is_active && (
              <Badge className="bg-green-600">Active</Badge>
            )}
            {connection.is_verified && (
              <Badge variant="outline" className="border-green-600 text-green-600">
                Verified
              </Badge>
            )}
          </div>
          {connection.description && (
            <p className="text-sm text-gray-600">{connection.description}</p>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2 mb-4 text-sm">
        <div>
          <span className="text-gray-600">URL:</span>
          <code className="ml-2 bg-gray-100 px-2 py-1 rounded text-xs">
            {connection.base_url}
          </code>
        </div>

        {/* Masked Credentials Display */}
        <div className="space-y-1">
          <div>
            <span className="text-gray-600">API Key:</span>
            <code className="ml-2 bg-gray-100 px-2 py-1 rounded text-xs font-mono">
              {connection.api_key_masked || 'sk_****'}
            </code>
          </div>

          <div>
            <span className="text-gray-600">API Secret:</span>
            <code className="ml-2 bg-gray-100 px-2 py-1 rounded text-xs font-mono">
              {connection.api_secret_masked || 'ss_****'}
            </code>
          </div>
        </div>

        {connection.last_tested_at && (
          <div className="text-xs text-gray-500">
            Last tested: {new Date(connection.last_tested_at).toLocaleDateString()}
          </div>
        )}

        {connection.rotated_at && (
          <div className="text-xs text-gray-500">
            Last rotated: {new Date(connection.rotated_at).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Security Notice */}
      {(connection.is_active || connection.is_verified) && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-4 flex gap-2 text-xs">
          <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <span className="text-blue-800">
            Secrets are encrypted at rest and require password verification to view
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => setShowPasswordModal(true)}
        >
          <Eye className="h-4 w-4" />
          View Secrets
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="gap-2 text-orange-600 hover:text-orange-700 border-orange-200 hover:bg-orange-50 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/20"
          onClick={() => setShowPasswordModal(true)}
          onClickCapture={() => {
            // Store intent to rotate after password verification
            setTimeout(() => {
              if (verificationToken) {
                setShowRotateModal(true);
              }
            }, 0);
          }}
        >
          <RotateCw className="h-4 w-4" />
          Rotate Keys
        </Button>

        <Button
          size="sm"
          variant="destructive"
          className="gap-2 ml-auto"
          onClick={() => handleDeleteConnection()}
          disabled={deleting}
        >
          <Trash2 className="h-4 w-4" />
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </div>

      {/* Modals */}
      <PasswordVerificationModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={(token) => {
          handlePasswordVerified(token, 15 * 60);
          // Check if user wants to rotate or view (default to view)
          setShowSecrets(true);
        }}
        title={showRotateModal ? 'Confirm Password' : 'View Sensitive Credentials'}
        description="Enter your password to access encrypted secrets"
        actionText="Verify"
      />

      {/* Secret Reveal Display */}
      {showSecrets && decryptedSecrets && (
        <div className="mt-4">
          <SecretRevealDisplay
            connectionName={connection.name}
            apiKey={decryptedSecrets.api_key}
            apiSecret={decryptedSecrets.api_secret}
            onHide={() => {
              setShowSecrets(false);
              setDecryptedSecrets(null);
            }}
          />
        </div>
      )}

      {/* Key Rotation Modal */}
      {verificationToken && (
        <KeyRotationModal
          isOpen={showRotateModal}
          onClose={() => setShowRotateModal(false)}
          onSuccess={() => {
            setShowRotateModal(false);
            setShowSecrets(false);
            setVerificationToken('');
            onRefresh?.();
          }}
          connectionId={connection.id}
          connectionName={connection.name}
          verificationToken={verificationToken}
        />
      )}
    </div>
  );
}
