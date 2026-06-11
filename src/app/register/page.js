/**
 * Register Page - Futuristic Glassmorphism Design
 * New account creation interface
 */

import AnimatedAuthBackground from '@/components/auth/AnimatedAuthBackground';
import { ConstyIcon } from '@/components/Logo';

export const metadata = {
  title: 'Access Restricted - Consty',
  description: 'Consty is managed by your organization. Contact your administrator for access.',
};

export default function RegisterPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
      <AnimatedAuthBackground />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg mb-4">
            <ConstyIcon size={48} />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Access Restricted</h1>
          <p className="text-muted-foreground">Consty is provisioned by your project administrator</p>
        </div>

        {/* Card */}
        <div className="backdrop-blur-xl bg-white/90 dark:bg-white/[0.07] border border-border dark:border-white/[0.12] rounded-2xl shadow-2xl shadow-gray-200/50 dark:shadow-black/20 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Registration Disabled</h2>
          <p className="text-sm text-muted-foreground">
            Public self-registration is not available. User accounts are created exclusively
            by a system administrator through the staff management panel.
          </p>
          <p className="text-sm text-muted-foreground">
            Contact your administrator to request access.
          </p>
          <a
            href="/login"
            className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}
