import { redirect } from 'next/navigation';

// Old /settings/theme – redirected to the new appearance page
export default function ThemePageRedirect() {
  redirect('/app/settings/appearance');
}
