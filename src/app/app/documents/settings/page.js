import { Suspense } from 'react';
import DocumentSettingsPage from '@/components/documents/DocumentSettingsPage';

export default function DocumentSettings() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DocumentSettingsPage />
    </Suspense>
  );
}

export const metadata = {
  title: 'Document Settings | CONSTY',
  description: 'Configure document system settings and branding',
};