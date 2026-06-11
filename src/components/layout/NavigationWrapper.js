'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';

/**
 * Navigation Wrapper Component
 * Only renders Sidebar and Navbar on /app and /admin routes
 */ 
export function NavigationWrapper() {
  const pathname = usePathname();
  
  // Show navigation only on /app and /admin routes
  const showNavigation = pathname.startsWith('/app') || pathname.startsWith('/admin');
  
  if (!showNavigation) {
    return null;
  }

  return (
    <>
      {/* Sidebar Navigation - Desktop Only */}
      <Sidebar />

      {/* Top Navigation Bar - Desktop Only */}
      <Navbar />
    </>
  );
}
