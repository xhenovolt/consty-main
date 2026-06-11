'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, LayoutDashboard, ArrowLeft, Search } from 'lucide-react';

/**
 * Custom 404 Not Found page
 * Replaces Next.js default 404 with branded UI and navigation shortcuts.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        {/* Error code */}
        <div className="text-8xl font-black text-primary/20 select-none mb-2">404</div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground mb-3">Page not found</h1>

        {/* Description */}
        <p className="text-muted-foreground mb-8 leading-relaxed">
          The page you&#39;re looking for doesn&#39;t exist or has been moved.
          Double-check the URL or navigate back to a known page.
        </p>

        {/* Navigation actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Link
            href="/app/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition"
          >
            <LayoutDashboard size={16} />
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-border text-foreground rounded-lg font-medium text-sm hover:bg-muted/50 transition"
          >
            <Home size={16} />
            Go Home
          </Link>
        </div>

        {/* Helpful links */}
        <div className="text-sm text-muted-foreground">
          <p className="mb-3">Or go directly to:</p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            {[
              { label: 'Prospects', href: '/app/prospects' },
              { label: 'Deals', href: '/app/deals' },
              { label: 'Finance', href: '/app/finance' },
              { label: 'Reports', href: '/app/reports' },
              { label: 'Docs', href: '/docs' },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-primary hover:underline"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
