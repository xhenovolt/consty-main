/**
 * Compatibility redirect for /dashboard
 * Legacy and external links that reference /dashboard are transparently forwarded
 * to the real dashboard at /app/dashboard.
 */
import { redirect } from 'next/navigation';

export default function DashboardCompat() {
  redirect('/app/dashboard');
}
