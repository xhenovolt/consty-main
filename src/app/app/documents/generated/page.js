import { Suspense } from 'react';
import GeneratedDocumentsPage from '@/components/documents/GeneratedDocumentsPage';

export default function GeneratedDocuments() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GeneratedDocumentsPage />
    </Suspense>
  );
}

export const metadata = {
  title: 'Generated Documents | CONSTY',
  description: 'View and manage generated documents',
};