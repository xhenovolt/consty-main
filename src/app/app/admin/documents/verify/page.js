'use client';

import { useState } from 'react';

export default function VerifyPage() {
  const [documentId, setDocumentId] = useState('');
  const [showLink, setShowLink] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (documentId.trim()) {
      setShowLink(true);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Document Verification Portal</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Verify the authenticity of official CONSTY documents
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Enter Document ID
              </label>
              <input
                type="text"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value.toUpperCase())}
                placeholder="e.g., XTN-INT-2026-0001"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-lg"
              />
            </div>

            <button
              type="submit"
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Verify Document
            </button>
          </form>

          {showLink && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                Verification link is ready:
              </p>
              <Link
                href={`/verify/${documentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition break-all"
              >
                {`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify/${documentId}`}
              </Link>
            </div>
          )}
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 dark:text-green-100 mb-3">✓ How to Verify</h3>
          <ol className="space-y-2 text-sm text-green-800 dark:text-green-200">
            <li>1. Obtain the document ID (e.g., XTN-INT-2026-0001) from the document footer</li>
            <li>2. Enter the ID above to receive a verification link</li>
            <li>3. Click the link to view document details and authenticity status</li>
            <li>4. Each verification is logged and tracked</li>
          </ol>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">ℹ Information</h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>• Each document is assigned a unique ID and QR code</li>
            <li>• Verification URLs can be shared publicly without authentication</li>
            <li>• Revoked documents will display a revocation notice</li>
            <li>• Each verification attempt is logged for audit trails</li>
            <li>• QR codes can be scanned to automatically verify documents</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
