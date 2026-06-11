'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function GeneratedPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', search: '' });

  // Template picker — second entry point for the generate flow. Lets a
  // user start "new document" from the list without first navigating
  // into the templates section.
  const [showPicker, setShowPicker] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const openPicker = async () => {
    setShowPicker(true);
    if (templates.length > 0) return;
    setPickerLoading(true);
    try {
      const res = await fetch('/api/documents/templates');
      const data = await res.json();
      setTemplates((data.data || []).filter(t => t.is_active !== false));
    } finally { setPickerLoading(false); }
  };

  useEffect(() => {
    fetchDocuments();
  }, [filter]);

  const fetchDocuments = async () => {
    try {
      const params = new URLSearchParams();
      if (filter.type) params.append('document_type', filter.type);
      if (filter.search) params.append('recipient_email', filter.search);

      const res = await fetch(`/api/documents/generate?${params}`);
      const data = await res.json();
      setDocuments(data.data || []);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (docId) => {
    if (!confirm('Are you sure you want to revoke this document?')) return;

    try {
      const res = await fetch('/api/documents/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: docId,
          reason: 'Revoked by administrator',
        }),
      });

      if (res.ok) {
        fetchDocuments();
      } else {
        alert('Failed to revoke document');
      }
    } catch (error) {
      console.error('Failed to revoke:', error);
      alert('Error: ' + error.message);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Generated Documents</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              View and manage all generated official documents
            </p>
          </div>
          <button onClick={openPicker}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer">
            ✨ New Document
          </button>
        </div>

        <div className="flex gap-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <input
            type="text"
            placeholder="Search by email or recipient name..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <select
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Types</option>
            <option value="internship_acceptance">Internship Acceptance</option>
            <option value="interview_invitation">Interview Invitation</option>
            <option value="job_application_response">Job Response</option>
            <option value="certificate">Certificate</option>
            <option value="award">Award</option>
            <option value="other">Other</option>
          </select>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg h-16 animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400">No documents found</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Document ID
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Recipient
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Views
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Generated
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                    <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">
                      {doc.unique_id}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-gray-900 dark:text-white">{doc.recipient_name}</div>
                      <div className="text-gray-600 dark:text-gray-400">{doc.recipient_email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white capitalize">
                      {doc.document_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {doc.viewed_count}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(doc.generated_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {doc.is_revoked ? (
                        <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full text-xs font-medium">
                          Revoked
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-xs font-medium">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right space-x-3">
                      {/* Manage = internal admin view (edit, change expiry, revoke).
                          Public = the QR-scannable verify page in a new tab. */}
                      <Link
                        href={`/app/admin/documents/generated/${doc.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Manage
                      </Link>
                      <a
                        href={`/verify/${doc.unique_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:underline"
                        title="Open the public verify page in a new tab"
                      >
                        Public
                      </a>
                      {!doc.is_revoked && (
                        <button
                          onClick={() => handleRevoke(doc.id)}
                          className="text-red-600 dark:text-red-400 hover:underline"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Template picker — clicking a row routes to the template detail
          page with ?generate=1 which auto-opens the generate modal there.
          One source of truth for the generate form. */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Pick a template</h3>
              <button onClick={() => setShowPicker(false)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Choose which template to generate a document from. Don't see what you need? <Link href="/app/admin/documents/templates" className="underline">Create a new template</Link>.
            </p>
            {pickerLoading ? (
              <div className="text-sm text-gray-500 text-center py-8">Loading templates…</div>
            ) : templates.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-8">
                No active templates yet. <Link href="/app/admin/documents/templates" className="text-blue-600 dark:text-blue-400 underline">Create one</Link> first.
              </div>
            ) : (
              <ul className="space-y-2">
                {templates.map(t => (
                  <li key={t.id}>
                    <button
                      onClick={() => router.push(`/app/admin/documents/templates/${t.id}?generate=1`)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition cursor-pointer">
                      <div className="font-medium text-gray-900 dark:text-white">{t.name}</div>
                      {t.description && <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>}
                      <div className="text-xs text-gray-400 mt-1">Category: {t.category || 'General'}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end pt-2">
              <button onClick={() => setShowPicker(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
