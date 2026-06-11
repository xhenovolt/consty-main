'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DocumentsPage() {
  const [stats, setStats] = useState({
    templates: 0,
    generated: 0,
    verifications: 0,
  });
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [templatesRes, generatedRes] = await Promise.all([
          fetch('/api/documents/templates'),
          fetch('/api/documents/generate'),
        ]);

        const templatesData = await templatesRes.json();
        const generatedData = await generatedRes.json();

        const generatedTotal = generatedData?.total;
        const generatedCount =
          typeof generatedTotal === 'number'
            ? generatedTotal
            : typeof generatedTotal === 'string'
            ? Number(generatedTotal) || 0
            : 0;

        setStats({
          templates: templatesData.data?.length || 0,
          generated: generatedCount,
          verifications: 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMessage('');
    try {
      const res = await fetch('/api/documents/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'all' }),
      });

      const data = await res.json();
      if (data.success) {
        setSeedMessage('✓ Sample templates and documents created successfully');
        setTimeout(() => {
          setSeedMessage('');
          window.location.reload();
        }, 2000);
      } else {
        setSeedMessage('✗ Seeding failed: ' + data.error);
      }
    } catch (error) {
      setSeedMessage('✗ Error: ' + error.message);
    } finally {
      setSeeding(false);
    }
  };

  const sections = [
    {
      title: 'Templates',
      description: 'Create and manage document templates',
      href: '/app/admin/documents/templates',
      icon: '📋',
      count: stats.templates,
    },
    {
      title: 'Generated Documents',
      description: 'View and manage generated official documents',
      href: '/app/admin/documents/generated',
      icon: '📄',
      count: stats.generated,
    },
    {
      title: 'Verification Portal',
      description: 'Public document verification system',
      href: '/app/admin/documents/verify',
      icon: '✓',
      count: stats.verifications,
    },
    {
      title: 'Company Branding',
      description: 'Manage organization branding and signatures',
      href: '/app/admin/documents/settings',
      icon: '🎨',
      count: 1,
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Organization Documents</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Professional document generation, verification, and management
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg h-32 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {sections.map((section) => (
              <Link key={section.href} href={section.href}>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-400 transition cursor-pointer">
                  <div className="text-4xl mb-2">{section.icon}</div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1">
                    {section.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {section.description}
                  </p>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {section.count}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h2 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Getting Started</h2>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200 mb-4">
            <li>• Create document templates with placeholder variables (e.g., {'{{applicant_name}}'})</li>
            <li>• Generate official documents with automatic ID generation (XTN-INT-2026-0001)</li>
            <li>• Each document includes a QR code for public verification</li>
            <li>• Share verification URL: https://verify.consty.example.com/verify/[document-id]</li>
            <li>• Configure company branding, signatures, and letterhead in settings</li>
          </ul>
          {/* Always show the seed button — seedDocumentTemplates and
              seedMukunguHatimu are idempotent (they UPDATE rows that
              already exist) so the same click safely refreshes copy in
              templates that have been seeded before. */}
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {seeding
              ? 'Seeding…'
              : stats.templates === 0
                ? 'Create Sample Templates & Documents'
                : 'Re-seed (refresh templates & sample doc)'}
          </button>
          {seedMessage && (
            <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-blue-300 dark:border-blue-700 text-sm">
              {seedMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
