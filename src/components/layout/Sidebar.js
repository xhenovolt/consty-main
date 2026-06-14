'use client';

/**
 * Enhanced Sidebar Navigation - Futuristic Design
 * Collapsible, theme-aware sidebar with smooth animations
 * Features: collapse/expand, tooltips, active states, dark mode, keyboard nav
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConstyIcon } from '@/components/Logo';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Building2,
  Zap,
  TrendingUp,
  Wallet,
  Handshake,
  Eye,
  Users,
  BookOpen,
  Settings,
  ChevronDown,
  ChevronLeft,
  LogOut,
  Plus,
  Percent,
  Target,
  Shield,
  UserPlus,
  FileText,
  X,
} from 'lucide-react';
import { menuItems as configMenuItems } from '@/lib/navigation-config';
import { filterMenuByPermissions } from '@/lib/nav-permissions';
import { usePermissions } from '@/components/providers/PermissionProvider';

/**
 * Tooltip Component
 */
function Tooltip({ children, label }) {
  const [show, setShow] = useState(false);

  return (
    <div 
      className="relative group w-full"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className="absolute left-full ml-3 px-3 py-1.5 text-xs rounded-lg whitespace-nowrap pointer-events-none z-50 font-medium shadow-xl"
          style={{ background: 'var(--theme-navbar, #0f172a)', color: 'var(--sidebar-text, #f1f5f9)' }}
        >
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent" style={{ borderRightColor: 'var(--theme-navbar, #0f172a)' }} />
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    'Project Pipeline': true,
    Projects: true,
    Finance: true,
    'Sites & Systems': false,
    Operations: false,
    Intelligence: false,
    Admin: false,
    'DRAIS Control': false,
  });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const quickAddRef = useRef(null);
  const { user: permUser, hasPermission, hasModuleAccess, hasAnyPermission, hierarchyLevel, loading: permLoading } = usePermissions();

  const displayMenuItems = useMemo(
    () => filterMenuByPermissions(configMenuItems, {
      user: permUser, permLoading, hierarchyLevel, hasPermission, hasModuleAccess,
    }),
    [permUser, permLoading, hasPermission, hasModuleAccess, hierarchyLevel]
  );

  // Close quick-add dropdown on outside click or Escape
  useEffect(() => {
    if (!showQuickAdd) return;
    const handler = (e) => {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target)) setShowQuickAdd(false);
    };
    const escHandler = (e) => { if (e.key === 'Escape') setShowQuickAdd(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', escHandler); };
  }, [showQuickAdd]);

  useEffect(() => {
    if (permUser) {
      setUser(permUser);
      setLoading(false);
    } else if (!permLoading) {
      setLoading(false);
    }
  }, [permUser, permLoading]);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved) setIsCollapsed(JSON.parse(saved));
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const newState = !prev;
      localStorage.setItem('sidebar-collapsed', JSON.stringify(newState));
      window.dispatchEvent(new CustomEvent('sidebar-toggled'));
      return newState;
    });
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isActive = (href) => pathname === href;
  const isParentActive = (submenu) => submenu?.some((item) => pathname === item.href);

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <motion.aside
      animate={{ width: isCollapsed ? '5rem' : '16rem' }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="hidden md:flex fixed left-0 top-0 h-screen flex-col shadow-xl overflow-hidden z-40"
      style={{ background: 'var(--theme-sidebar, #0f172a)', borderRight: '1px solid var(--sidebar-border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <ConstyIcon size={32} />
            <span className="font-bold text-lg" style={{ color: 'var(--sidebar-text)' }}>Consty</span>
          </motion.div>
        )}
        <button
          onClick={toggleCollapse}
          className="p-1.5 hover:bg-[var(--sidebar-hover)] rounded-lg transition-colors ml-auto"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }}>
            <ChevronLeft size={20} style={{ color: 'var(--sidebar-muted)' }} />
          </motion.div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-thin">
        <AnimatePresence>
          {displayMenuItems.map((item) => {
            if (item.kind === 'header') {
              if (isCollapsed) {
                return <div key={`h-${item.label}`} className="my-2 mx-3" style={{ borderTop: '1px solid var(--sidebar-border)' }} />;
              }
              return (
                <div
                  key={`h-${item.label}`}
                  className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider select-none"
                  style={{ color: 'var(--sidebar-muted)' }}
                >
                  {item.label}
                </div>
              );
            }
            const Icon = item.icon;
            const hasSubmenu = item.submenu && item.submenu.length > 0;
            const isExpanded = expandedSections[item.label];
            const isItemActive = isActive(item.href);
            const isParentItemActive = isParentActive(item.submenu);

            if (!hasSubmenu) {
              return (
                <Tooltip key={item.href} label={item.label}>
                  <Link
                    href={item.href}
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                      isItemActive
                        ? 'shadow-sm'
                        : ''
                    }`}
                    style={isItemActive
                      ? { background: 'var(--sidebar-active)', color: 'var(--sidebar-active-txt)' }
                      : { color: 'var(--sidebar-muted)' }}
                    onMouseEnter={e => { if (!isItemActive) { e.currentTarget.style.background = 'var(--sidebar-hover)'; e.currentTarget.style.color = 'var(--sidebar-text)'; }}}
                    onMouseLeave={e => { if (!isItemActive) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--sidebar-muted)'; }}}
                  >
                    <Icon size={20} style={isItemActive ? { color: 'var(--theme-primary)' } : {}} />
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-sm font-medium flex-1"
                      >
                        {item.label}
                      </motion.span>
                    )}
                    {isItemActive && (
                      <motion.div
                        layoutId="activeSidebarDirect"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full"
                        style={{ background: 'var(--theme-primary, #3b82f6)' }}
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </Link>
                </Tooltip>
              );
            } else {
              return (
                <div key={item.label}>
                  <Tooltip label={item.label}>
                    <button
                      onClick={() => toggleSection(item.label)}
                      className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                        isParentItemActive
                          ? ''
                          : ''
                      }`}
                      style={isParentItemActive
                        ? { background: 'var(--sidebar-hover)', color: 'var(--sidebar-text)' }
                        : { color: 'var(--sidebar-muted)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-hover)'; e.currentTarget.style.color = 'var(--sidebar-text)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isParentItemActive ? 'var(--sidebar-hover)' : ''; e.currentTarget.style.color = isParentItemActive ? 'var(--sidebar-text)' : 'var(--sidebar-muted)'; }}
                    >
                      <Icon size={20} style={isParentItemActive ? { color: 'var(--theme-primary)' } : {}} />
                      {!isCollapsed && (
                        <>
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-sm font-medium flex-1 text-left"
                          >
                            {item.label}
                          </motion.span>
                          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                            <ChevronDown size={16} />
                          </motion.div>
                        </>
                      )}
                      {isParentItemActive && (
                        <div
                          layoutId={undefined}
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full bg-purple-500"
                        />
                      )}
                    </button>
                  </Tooltip>

                  <AnimatePresence>
                    {isExpanded && !isCollapsed && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-6 space-y-0.5 py-1" style={{ borderLeft: '1px solid var(--sidebar-border)' }}>
                          {item.submenu.map((subitem) => (
                            <Link
                              key={subitem.href}
                              href={subitem.href}
                              className="relative block px-3 py-2 text-sm rounded-lg transition-all duration-200"
                              style={isActive(subitem.href)
                                ? { color: 'var(--theme-primary)', fontWeight: '500', background: 'var(--sidebar-hover)' }
                                : { color: 'var(--sidebar-muted)' }}
                              onMouseEnter={e => { if (!isActive(subitem.href)) { e.currentTarget.style.color = 'var(--sidebar-text)'; e.currentTarget.style.background = 'var(--sidebar-hover)'; }}}
                              onMouseLeave={e => { if (!isActive(subitem.href)) { e.currentTarget.style.color = 'var(--sidebar-muted)'; e.currentTarget.style.background = ''; }}}
                            >
                              {subitem.label}
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }
          })}
        </AnimatePresence>
      </nav>

      {/* Quick Add Menu */}
      <div ref={quickAddRef} className="p-2 relative" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        <Tooltip label="Quick create">
          <button
            onClick={() => setShowQuickAdd(prev => !prev)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-white font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            style={{ background: `linear-gradient(135deg, var(--theme-primary, #3b82f6), var(--theme-accent, #6366f1))` }}
          >
            <motion.div animate={{ rotate: showQuickAdd ? 45 : 0 }} transition={{ duration: 0.2 }}>
              <Plus size={18} />
            </motion.div>
            {!isCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm">
                Add
              </motion.span>
            )}
          </button>
        </Tooltip>

        {/* Quick Create Dropdown */}
        <AnimatePresence>
          {showQuickAdd && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-2 right-2 mb-2 rounded-xl overflow-hidden shadow-2xl z-50"
              style={{ background: 'var(--theme-sidebar, #0f172a)', border: '1px solid var(--sidebar-border)' }}
            >
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sidebar-muted)' }}>
                Create new
              </div>
              {[
                { label: 'New Project', icon: Target, href: '/app/deals/new', desc: 'Start a new project' },
                { label: 'Log Payment', icon: Wallet, href: '/app/payments?new=1', desc: 'Record a client payment' },
                { label: 'Follow-up', icon: FileText, href: '/app/followups?new=1', desc: 'Add a note or follow-up' },
              ].map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setShowQuickAdd(false)}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors"
                  style={{ color: 'var(--sidebar-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-hover)'; e.currentTarget.style.color = 'var(--sidebar-text)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--sidebar-muted)'; }}
                >
                  <item.icon size={16} />
                  {!isCollapsed && (
                    <div>
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs opacity-60">{item.desc}</div>
                    </div>
                  )}
                </Link>
              ))}
              <button
                onClick={() => setShowQuickAdd(false)}
                className="w-full flex items-center justify-center gap-1 py-2 text-xs transition-colors"
                style={{ borderTop: '1px solid var(--sidebar-border)', color: 'var(--sidebar-muted)' }}
              >
                <X size={12} /> Close
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-2 space-y-1" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        <Tooltip label="Settings">
          <Link
            href="/app/settings"
            className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
            style={isActive('/app/settings')
              ? { background: 'var(--sidebar-active)', color: 'var(--sidebar-active-txt)' }
              : { color: 'var(--sidebar-muted)' }}
            onMouseEnter={e => { if (!isActive('/app/settings')) { e.currentTarget.style.background = 'var(--sidebar-hover)'; e.currentTarget.style.color = 'var(--sidebar-text)'; }}}
            onMouseLeave={e => { if (!isActive('/app/settings')) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--sidebar-muted)'; }}}
          >
            <Settings size={20} />
            {!isCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm font-medium flex-1">
                Settings
              </motion.span>
            )}
          </Link>
        </Tooltip>

        <Tooltip label="Logout">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
            style={{ color: 'var(--sidebar-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--sidebar-muted)'; }}
          >
            <LogOut size={20} />
            {!isCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm font-medium flex-1 text-left">
                Logout
              </motion.span>
            )}
          </button>
        </Tooltip>
      </div>
    </motion.aside>
  );
}
