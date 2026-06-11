import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/current-user.js';

/**
 * Login Page Layout
 * Server-side check: if already authenticated, redirect to dashboard
 */
export default async function LoginLayout({ children }) {
  const user = await getCurrentUser();
  
  // If already logged in, redirect to dashboard
  if (user) {
    redirect('/app/dashboard');
  }

  return children;
}
