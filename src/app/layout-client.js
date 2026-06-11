'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { PageTitle } from '@/components/layout/PageTitle';
import { useHeartbeat } from '@/lib/use-heartbeat';
import SplashScreen from '@/components/SplashScreen';
import { initializeErrorLogger } from '@/lib/error-logger';
import { SPLASH_STORAGE_KEY } from '@/lib/auth-cookies';
import { APP_NAME, APP_TAGLINE } from '@/lib/product';

const mockUser = {
  name: 'Admin User',
  email: 'admin@consty.local',
  role: 'Administrator',
  avatar: '👤',
};

export default function LayoutClient({ children }) {
  useHeartbeat(); // Send heartbeat pings every tab is active
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const pathname = usePathname();

  // ── Initialize global error logging on mount ──
  useEffect(() => {
    initializeErrorLogger();
  }, []);

  // Show splash screen once per session on /app routes
  useEffect(() => {
    if (pathname.startsWith('/app') && !sessionStorage.getItem(SPLASH_STORAGE_KEY)) {
      setShowSplash(true);
    }
  }, []);

  const handleSplashFinished = useCallback(() => {
    setShowSplash(false);
    sessionStorage.setItem(SPLASH_STORAGE_KEY, '1');
  }, []);
  
  // Show navigation only on /app and /admin routes
  const showNavigation = pathname.startsWith('/app') || pathname.startsWith('/admin');
  
  // Monitor sidebar collapsed state
  useEffect(() => {
    const checkSidebarState = () => {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved) setIsCollapsed(JSON.parse(saved));
    };

    checkSidebarState();

    // Listen for sidebar toggle events
    const handleSidebarToggle = () => {
      checkSidebarState();
    };

    window.addEventListener('sidebar-toggled', handleSidebarToggle);
    return () => window.removeEventListener('sidebar-toggled', handleSidebarToggle);
  }, []);
  
  // Adjust main padding based on navigation visibility and sidebar state
  // Mobile: No top padding (navigation is drawer), bottom padding for bottom nav
  // Desktop: Top padding for navbar, left padding for sidebar
  const sidebarWidth = isCollapsed ? '5rem' : '16rem';
  const mainClasses = showNavigation 
    ? `flex-1 md:pt-16 pb-16 md:pb-0 min-h-screen transition-all duration-300 ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`
    : 'flex-1 min-h-screen';
  
  const footerClasses = showNavigation
    ? `py-8 text-center text-sm transition-all duration-300 ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`
    : 'py-8 text-center text-sm';

  return (
    <>
      {/* Splash Screen — shown once per session like WhatsApp */}
      {showSplash && <SplashScreen onFinished={handleSplashFinished} />}

      {/* Page Title Bar - Only on /app routes */}
      {showNavigation && <PageTitle />}

      {/* Main Content Area */}
      <main className={mainClasses}>
        {children}
      </main>

      {/* Footer */}
      <footer className={footerClasses} style={{ background: 'var(--footer-bg)', color: 'var(--footer-text)', borderTop: '1px solid var(--sidebar-border)' }}>
        <p className="mb-1">
          © {new Date().getFullYear()} {APP_NAME}. {APP_TAGLINE} • v1.0
        </p>
        <p className="text-xs text-muted-foreground">
          Built for modern construction teams.
        </p>
      </footer>

      {/* Mobile Bottom Navigation - Only on /app routes */}
      {showNavigation && (
        <MobileBottomNav 
          onDrawerOpen={() => setDrawerOpen(true)} 
        />
      )}

      {/* Mobile Drawer - Only on /app routes */}
      {showNavigation && (
        <MobileDrawer 
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          user={mockUser}
        />
      )}
    </>
  );
}
