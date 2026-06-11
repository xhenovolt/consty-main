import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/current-user.js';

/**
 * Register Page Layout
 * Server-side check: if already authenticated, redirect to dashboard
 */
export default async function RegisterLayout({ children }) {
  const user = await getCurrentUser();
  
  // If already logged in, redirect to dashboard
  if (user) {
    redirect('/app/dashboard');
  }

  return children;
}
