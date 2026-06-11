'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, X, LogOut, Settings, ChevronDown, Bell, Sun, Moon, Monitor, Palette, Type, Check, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

/**
 * Top Navigation Bar - Futuristic Design
 * Global search, notifications, theme toggle, and user profile
 */
export function Navbar() {
  const { colorMode, setColorMode, isDark } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const searchInputRef = useRef(null);
  const profileRef = useRef(null);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Notification state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => { fetchCurrentUser(); }, []);

  // Fetch notifications every 30 seconds
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=15', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNotifications(data.data || []);
          setUnreadCount(data.unread_count || 0);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Real-time SSE — when a notification arrives, prepend it
  useRealtimeNotifications({
    onNotification: useCallback((notif) => {
      setNotifications(prev => [notif, ...prev].slice(0, 15));
      setUnreadCount(prev => prev + 1);
    }, []),
    enabled: true,
  });

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true }),
      });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {}
  };

  const markRead = async (id) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const getNotifLink = (n) => {
    if (!n.reference_type || !n.reference_id) return null;
    const routes = {
      deal: `/app/deals/${n.reference_id}`,
      prospect: `/app/prospects/${n.reference_id}`,
      client: `/app/clients/${n.reference_id}`,
      system: `/app/systems/${n.reference_id}`,
      payment: `/app/payments`,
      operation: `/app/operations`,
      expense: `/app/finance/expenses`,
    };
    return routes[n.reference_type] || null;
  };

  const timeAgo = (date) => {
    const s = Math.floor((Date.now() - new Date(date)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  // Close notification dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotifOpen(false);
    };
    if (notifOpen) { document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }
  }, [notifOpen]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvatarText = () => {
    if (!user) return '?';
    return (user.name || user.full_name || user.email || '')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Sidebar state
  useEffect(() => {
    const checkSidebarState = () => {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved) setIsCollapsed(JSON.parse(saved));
    };
    checkSidebarState();
    const handleSidebarToggle = () => { setTimeout(checkSidebarState, 0); };
    window.addEventListener('storage', (e) => { if (e.key === 'sidebar-collapsed') checkSidebarState(); });
    window.addEventListener('sidebar-toggled', handleSidebarToggle);
    return () => { window.removeEventListener('sidebar-toggled', handleSidebarToggle); };
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !searchOpen) { e.preventDefault(); setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 0); }
      if (e.key === 'Escape' && searchOpen) { setSearchOpen(false); setSearchQuery(''); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  // Close profile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
    };
    if (profileOpen) { document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }
  }, [profileOpen]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length > 0) {
      const mockResults = [
        { id: 1, title: 'Dashboard', category: 'Pages', path: '/app/dashboard' },
        { id: 2, title: 'Prospects', category: 'Pipeline', path: '/app/prospects' },
        { id: 3, title: 'Deals', category: 'Sales', path: '/app/deals' },
        { id: 4, title: 'Finance', category: 'Money', path: '/app/finance' },
        { id: 5, title: 'Settings', category: 'Admin', path: '/app/settings' },
        { id: 6, title: 'Users', category: 'Admin', path: '/app/admin/users' },
      ].filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
      setSearchResults(mockResults);
    } else {
      setSearchResults([]);
    }
  };

  return (
    <motion.nav
      animate={{ left: isCollapsed ? '5rem' : '16rem' }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="hidden md:fixed md:top-0 md:right-0 md:h-16 md:z-30 md:px-6 md:flex md:items-center md:justify-between"
      style={{ background: 'var(--theme-navbar, #0f172a)', borderBottom: '1px solid var(--navbar-border)' }}
    >
      {/* Left side */}
      <div />

      {/* Center - Search */}
      <div className="flex-1 max-w-md mx-auto">
        <div className="relative">
          <div
            onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 0); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl cursor-text transition-all"
            style={{ background: 'var(--sidebar-hover)', border: '1px solid var(--navbar-border)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--theme-primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--navbar-border)'}>
            <Search size={16} style={{ color: 'var(--navbar-muted)' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search... (press /)"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              className="flex-1 bg-transparent focus:outline-none text-sm"
              style={{ color: 'var(--navbar-text)' }}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} style={{ color: 'var(--navbar-muted)' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl z-50 overflow-hidden" style={{ background: 'var(--theme-navbar)', border: '1px solid var(--navbar-border)' }}>
              <div className="max-h-80 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => { window.location.href = result.path; setSearchOpen(false); setSearchQuery(''); }}
                    className="w-full text-left px-4 py-3 transition-colors"
                    style={{ borderBottom: '1px solid var(--navbar-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <p className="font-medium text-sm" style={{ color: 'var(--navbar-text)' }}>{result.title}</p>
                    <p className="text-xs" style={{ color: 'var(--navbar-muted)' }}>{result.category}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchOpen && searchQuery && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl z-50 p-4 text-center" style={{ background: 'var(--theme-navbar)', border: '1px solid var(--navbar-border)' }}>
              <p className="text-sm" style={{ color: 'var(--navbar-muted)' }}>No results for &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        {/* Color-mode 3-way toggle */}
        <div className="flex items-center rounded-xl overflow-hidden" style={{ border: '1px solid var(--navbar-border)', background: 'var(--sidebar-hover)' }}>
          {[
            { mode: 'system', icon: Monitor, label: 'System' },
            { mode: 'light',  icon: Sun,     label: 'Light'  },
            { mode: 'dark',   icon: Moon,    label: 'Dark'   },
          ].map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setColorMode(mode)}
              title={label}
              className="p-2 transition-colors"
              style={colorMode === mode
                ? { background: 'var(--theme-primary)', color: '#ffffff' }
                : { color: 'var(--navbar-muted)' }}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) fetchNotifications(); }}
            className="relative p-2 rounded-xl transition-colors"
            style={{ color: 'var(--navbar-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--navbar-text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--navbar-muted)'}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-96 rounded-xl shadow-2xl z-50 overflow-hidden"
                style={{ background: 'var(--theme-navbar)', border: '1px solid var(--navbar-border)' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--navbar-border)' }}>
                  <span className="font-semibold text-sm" style={{ color: 'var(--navbar-text)' }}>Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--theme-primary, #3b82f6)' }}>
                      <CheckCheck size={14} /> Mark all read
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-[400px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center">
                      <Bell size={24} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--navbar-muted)' }} />
                      <p className="text-sm" style={{ color: 'var(--navbar-muted)' }}>No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map(n => {
                      const link = getNotifLink(n);
                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (!n.is_read) markRead(n.id);
                            if (link) { window.location.href = link; setNotifOpen(false); }
                          }}
                          className={`px-4 py-3 transition-colors ${link ? 'cursor-pointer' : ''} ${!n.is_read ? 'bg-blue-500/5' : ''}`}
                          style={{ borderBottom: '1px solid var(--navbar-border)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = !n.is_read ? 'rgba(59,130,246,0.05)' : ''}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!n.is_read ? 'bg-blue-500' : 'bg-transparent'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--navbar-text)' }}>{n.title}</p>
                              <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--navbar-muted)' }}>{n.message}</p>
                              <p className="text-[10px] mt-1" style={{ color: 'var(--navbar-muted)' }}>{timeAgo(n.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div className="px-4 py-2 text-center" style={{ borderTop: '1px solid var(--navbar-border)' }}>
                    <button
                      onClick={() => { window.location.href = '/app/notifications'; setNotifOpen(false); }}
                      className="text-xs font-medium hover:underline"
                      style={{ color: 'var(--theme-primary, #3b82f6)' }}
                    >
                      View all notifications →
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Profile */}
        <div ref={profileRef} className="relative ml-2">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors"
            onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold text-white overflow-hidden"
              style={{ background: `linear-gradient(135deg, var(--theme-primary, #3b82f6), var(--theme-accent, #6366f1))` }}
            >
              {getAvatarText()}
            </div>
            <div className="hidden sm:flex flex-col items-start">
              <p className="text-sm font-medium leading-tight" style={{ color: 'var(--navbar-text)' }}>
                {loading ? '...' : user?.name || user?.full_name || 'User'}
              </p>
              <p className="text-[10px] leading-tight" style={{ color: 'var(--navbar-muted)' }}>
                {loading ? '' : user?.is_superadmin ? 'Superadmin' : user?.role || 'User'}
              </p>
            </div>
            <ChevronDown size={14} className={`transition-transform ${profileOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--navbar-muted)' }} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl shadow-2xl z-50 overflow-hidden" style={{ background: 'var(--theme-navbar)', border: '1px solid var(--navbar-border)' }}>
              <div className="p-4" style={{ borderBottom: '1px solid var(--navbar-border)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg text-sm font-bold text-white flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, var(--theme-primary, #3b82f6), var(--theme-accent, #6366f1))` }}
                  >
                    {getAvatarText()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--navbar-text)' }}>{user?.name || user?.full_name || 'User'}</p>
                    <p className="text-xs" style={{ color: 'var(--navbar-muted)' }}>{user?.email}</p>
                    <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--theme-primary, #3b82f6)' }}>
                      {user?.is_superadmin ? 'Superadmin' : user?.role || 'User'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => { window.location.href = '/app/settings'; setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                  style={{ color: 'var(--navbar-text)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <Settings size={16} />
                  <span>Settings</span>
                </button>
                <button
                  onClick={() => { window.location.href = '/app/settings/appearance'; setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                  style={{ color: 'var(--navbar-text)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <Palette size={16} />
                  <span>Appearance</span>
                </button>
                <button
                  onClick={() => { window.location.href = '/app/settings/typography'; setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                  style={{ color: 'var(--navbar-text)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <Type size={16} />
                  <span>Typography</span>
                </button>
              </div>

              <div className="p-1" style={{ borderTop: '1px solid var(--navbar-border)' }}>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search backdrop */}
      {searchOpen && searchResults.length > 0 && (
        <div className="fixed inset-0 z-40" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} />
      )}
    </motion.nav>
  );
}
