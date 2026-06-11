'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, LogOut } from 'lucide-react';
import { menuItems as configMenuItems } from '@/lib/navigation-config';
import { filterMenuByPermissions } from '@/lib/nav-permissions';
import { usePermissions } from '@/components/providers/PermissionProvider';

/**
 * Mobile Drawer Navigation
 * 
 * Features:
 * - Full navigation accessible on mobile only
 * - Smooth Framer Motion animations
 * - Focus trap while open (ESC to close)
 * - Click-outside to close with backdrop
 * - Organized navigation sections
 * - Active route highlighting
 * - User profile section
 */
export function MobileDrawer({ isOpen, onClose, user }) {
  const pathname = usePathname();
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const { user: permUser, hasPermission, hasModuleAccess, hierarchyLevel, loading: permLoading } = usePermissions();
  const navMenuItems = useMemo(
    () => filterMenuByPermissions(configMenuItems, {
      user: permUser, permLoading, hierarchyLevel, hasPermission, hasModuleAccess,
    }),
    [permUser, permLoading, hierarchyLevel, hasPermission, hasModuleAccess]
  );
  const [expandedSections, setExpandedSections] = useState({
    Operations: false,
    'Sales & CRM': false,
    Investments: false,
    Finance: false,
    'Intellectual Property': false,
    Admin: false,
  });

  /**
   * Handle ESC key to close drawer
   * Part of focus trap implementation
   */
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
        // Return focus to the trigger button
        const triggerButton = document.querySelector('[data-drawer-trigger]');
        if (triggerButton) triggerButton.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when drawer is open
      document.body.style.overflow = 'hidden';
      
      // Focus management - focus close button when drawer opens
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);

      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, onClose]);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const isActive = (href) => pathname === href;

  const isParentActive = (submenu) => {
    return submenu?.some((item) => pathname === item.href);
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleLinkClick = () => {
    // Close drawer after navigation
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop with blur effect */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      </AnimatePresence>

      {/* Drawer Panel */}
      <motion.div
        ref={drawerRef}
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="md:hidden fixed left-0 top-0 bottom-0 w-64 bg-background border-r border-border z-50 overflow-y-auto flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation drawer"
      >
        {/* Header with Close Button */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background z-10">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Consty
          </h1>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 hover:bg-muted dark:hover:bg-muted rounded-lg transition-colors"
            aria-label="Close navigation drawer"
            data-drawer-trigger
          >
            <X size={24} className="text-muted-foreground" />
          </button>
        </div>

        {/* User Profile Section */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 border-b border-border"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600/20 text-lg font-semibold">
              {user.avatar}
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">
                {user.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {user.email}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">
                {user.role}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          <AnimatePresence>
            {navMenuItems.map((item, index) => {
              const Icon = item.icon;
              const hasSubmenu = item.submenu && item.submenu.length > 0;
              const isExpanded = expandedSections[item.label];
              const isItemActive = isActive(item.href);
              const isParentItemActive = isParentActive(item.submenu);

              if (!hasSubmenu) {
                // Direct link
                return (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <Link
                      href={item.href}
                      onClick={handleLinkClick}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isItemActive
                          ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-medium'
                          : 'text-foreground hover:bg-muted dark:hover:bg-muted'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-sm">{item.label}</span>
                      {isItemActive && (
                        <motion.div
                          layoutId="activeMobileIndicator"
                          className="ml-auto w-1 h-6 bg-blue-600 rounded-r-lg"
                        />
                      )}
                    </Link>
                  </motion.div>
                );
              } else {
                // Parent with submenu
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    {/* Parent Button */}
                    <button
                      onClick={() => toggleSection(item.label)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isParentItemActive
                          ? 'bg-purple-600/10 text-purple-600 dark:text-purple-400 font-medium'
                          : 'text-foreground hover:bg-muted dark:hover:bg-muted'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-sm flex-1 text-left">{item.label}</span>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown size={16} />
                      </motion.div>
                      {isParentItemActive && (
                        <motion.div
                          layoutId="activeMobileParentIndicator"
                          className="ml-auto w-1 h-6 bg-purple-600 rounded-r-lg"
                        />
                      )}
                    </button>

                    {/* Submenu */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="ml-8 border-l border-border space-y-1 py-2">
                            {item.submenu.map((subitem, subindex) => (
                              <motion.div
                                key={subitem.href}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: subindex * 0.02 }}
                              >
                                <Link
                                  href={subitem.href}
                                  onClick={handleLinkClick}
                                  className={`block px-4 py-2 text-sm rounded-lg transition-colors ${
                                    isActive(subitem.href)
                                      ? 'text-blue-600 dark:text-blue-400 font-medium bg-blue-600/5'
                                      : 'text-muted-foreground hover:text-foreground dark:hover:text-foreground hover:bg-muted dark:hover:bg-muted'
                                  }`}
                                >
                                  {subitem.label}
                                </Link>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              }
            })}
          </AnimatePresence>
        </nav>

        {/* Logout Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 border-t border-border mt-auto"
        >
          <button
            onClick={async () => {
              await handleLogout();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium text-sm dark:bg-red-900/30"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </motion.div>
      </motion.div>
    </>
  );
}
