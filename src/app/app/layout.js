import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/current-user.js';
import { RoutePermissionGuard } from '@/components/layout/RoutePermissionGuard';

/**
 * Protected App Layout
 * Server-side auth check before rendering any /app/* routes.
 * Wraps children in RoutePermissionGuard for client-side permission enforcement.
 */
export default async function AppLayout({ children }) {
  // Check authentication on server before rendering
  const user = await getCurrentUser();
  
  // If no valid session, redirect to login
  if (!user) {
    console.warn('[AppLayout] No valid session found — redirecting to /login');
    redirect('/login');
  }

  // User is authenticated — apply route-level permission guard
  return <RoutePermissionGuard>{children}</RoutePermissionGuard>;
}
