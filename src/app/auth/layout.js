import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/current-user.js';

/**
 * Auth Pages Layout
 * Server-side check: if already authenticated, redirect to dashboard
 * This prevents logged-in users from seeing login/register pages
 */
export default async function AuthLayout({ children }) {
  // Check if user is already authenticated
  const user = await getCurrentUser();
  
  // If already logged in, redirect to dashboard
  if (user) {
    redirect('/app/dashboard');
  }

  // User is not authenticated - show auth pages
  return children;
}
