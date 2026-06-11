/**
 * App Root Page
 * Server-side redirect to dashboard — avoids the extra client-side hop that
 * a useEffect/router.replace approach would add, which can cause cookie loss
 * during rapid redirect chains.
 */

import { redirect } from 'next/navigation';

export default function AppPage() {
  redirect('/app/dashboard');
}
