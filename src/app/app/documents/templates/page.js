import { Suspense } from 'react';
import TemplatesPage from '@/components/documents/TemplatesPage';

export default function Templates() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TemplatesPage />
    </Suspense>
  );
}

export const metadata = {
  title: 'Document Templates | CONSTY',
  description: 'Manage document templates for professional document generation',
};