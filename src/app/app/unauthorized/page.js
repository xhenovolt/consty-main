import Link from 'next/link';
import { ShieldX, LayoutDashboard, Home } from 'lucide-react';

export const metadata = { title: 'Access Denied — Consty' };

/**
 * Unauthorized access page.
 * Displayed when a user's role does not have permission to access a route.
 */
export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">

        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-6">
          <ShieldX className="w-8 h-8 text-amber-600" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground mb-3">Access Denied</h1>

        {/* Description */}
        <p className="text-muted-foreground mb-8 leading-relaxed">
          You do not have permission to access this section.
          Contact your administrator if you believe this is an error.
        </p>

        {/* Explanation callout */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 mb-8 text-left dark:bg-amber-900/30 dark:text-amber-300">
          <p className="font-medium mb-1">Why am I seeing this?</p>
          <p>
            Consty uses role-based access control (RBAC). Your current role does not
            include permission to view or modify this resource. Your administrator
            can grant access by assigning the required permission to your role.
          </p>
        </div>

        {/* Navigation actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/app/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition"
          >
            <LayoutDashboard size={16} />
            Return to Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-border text-foreground rounded-lg font-medium text-sm hover:bg-muted/50 transition"
          >
            <Home size={16} />
            Go Home
          </Link>
        </div>

      </div>
    </div>
  );
}
