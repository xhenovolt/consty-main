import { Suspense } from 'react';
import VerificationPortalPage from '@/components/documents/VerificationPortalPage';

export default function VerificationPortal() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerificationPortalPage />
    </Suspense>
  );
}

export const metadata = {
  title: 'Document Verification Portal | CONSTY',
  description: 'Verify document authenticity and validity',
};