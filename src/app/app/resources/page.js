'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// DEPRECATED: Resources merged into unified Items system (migration 302)
export default function ResourcesPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/app/items'); }, [router]);
  return (
    <div className="p-8 text-center opacity-60">
      <p>Resources have been merged into the unified Items system.</p>
      <p className="text-sm mt-2">Redirecting to Items...</p>
    </div>
  );
}
