'use client';

/**
 * NewConversationModal — Staff-based user picker
 * NO manual username typing. Uses searchable staff/user list with role and hierarchy filtering.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Users, MessageCircle, Check, Loader2, Filter } from 'lucide-react';
import { api } from '@/lib/api-client';
import { LoadingButton } from '@/components/ui/LoadingButton';

export function NewConversationModal({ isOpen, onClose, onCreateConversation }) {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ roles: [], departments: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [conversationType, setConversationType] = useState('direct');
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (roleFilter) params.set('role', roleFilter);
    if (deptFilter) params.set('department', deptFilter);

    const res = await api.get(`/api/communication/users?${params}`, { silent: true });
    if (res.ok) {
      setUsers(res.data);
      if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
        // data comes from res.data (which is already the data field)
      }
    }
    // Try to get filters from a separate field
    const fullRes = await api.get('/api/communication/users?limit=1', { silent: true });
    if (fullRes.ok && fullRes.data) {
      // Check if filters are at the top level of the response
    }
    setLoading(false);
  }, [searchQuery, roleFilter, deptFilter]);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setTimeout(() => searchRef.current?.focus(), 100);
    } else {
      setSelectedUsers([]);
      setSearchQuery('');
      setGroupName('');
      setConversationType('direct');
    }
  }, [isOpen, fetchUsers]);

  const toggleUser = (user) => {
    setSelectedUsers(prev => {
      const exists = prev.find(u => u.id === user.id);
      if (exists) return prev.filter(u => u.id !== user.id);
      if (conversationType === 'direct') return [user];
      return [...prev, user];
    });
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) return;
    setCreating(true);
    try {
      await onCreateConversation(
        conversationType,
        conversationType === 'group' ? groupName : null,
        selectedUsers.map(u => u.id)
      );
      onClose();
    } catch (err) {
      // error handled by onCreateConversation
    }
    setCreating(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-card rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border border-border"
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">New Conversation</h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Selector */}
        <div className="px-4 pt-3 flex gap-2">
          <button
            onClick={() => { setConversationType('direct'); setSelectedUsers(prev => prev.slice(0, 1)); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
              conversationType === 'direct'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageCircle className="w-4 h-4" /> Direct
          </button>
          <button
            onClick={() => setConversationType('group')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
              conversationType === 'group'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" /> Group
          </button>
        </div>

        {/* Group Name */}
        {conversationType === 'group' && (
          <div className="px-4 pt-3">
            <input
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Group name..."
              className="w-full px-3 py-2 bg-muted text-foreground rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
        )}

        {/* Search + Filters */}
        <div className="px-4 pt-3 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-9 pr-3 py-2 bg-muted text-foreground text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition cursor-pointer ${showFilters ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-2 overflow-hidden"
              >
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-muted text-foreground text-xs rounded-lg border border-border"
                >
                  <option value="">All Roles</option>
                  {filters.roles?.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-muted text-foreground text-xs rounded-lg border border-border"
                >
                  <option value="">All Departments</option>
                  {filters.departments?.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Selected Users Tags */}
        {selectedUsers.length > 0 && (
          <div className="px-4 pt-2 flex flex-wrap gap-1.5">
            {selectedUsers.map(u => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
              >
                {u.full_name || u.email}
                <button onClick={() => toggleUser(u)} className="hover:text-primary/70 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* User List */}
        <div className="flex-1 overflow-y-auto px-2 pt-2 pb-2 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (Array.isArray(users) ? users : []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No users found
            </div>
          ) : (
            (Array.isArray(users) ? users : []).map(user => {
              const isSelected = selectedUsers.some(u => u.id === user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => toggleUser(user)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition cursor-pointer ${
                    isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                  }`}
                >
                  <img
                    src={user.avatar_url || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.full_name || user.email)}&size=40`}
                    alt=""
                    className="w-10 h-10 rounded-full bg-muted"
                  />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {user.full_name || user.email}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.role}{user.department ? ` · ${user.department}` : ''}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end gap-3">
          <LoadingButton variant="ghost" onClick={onClose}>Cancel</LoadingButton>
          <LoadingButton
            loading={creating}
            disabled={selectedUsers.length === 0 || (conversationType === 'group' && !groupName.trim())}
            onClick={handleCreate}
            loadingText="Creating..."
          >
            {conversationType === 'direct' ? 'Start Chat' : 'Create Group'}
          </LoadingButton>
        </div>
      </motion.div>
    </div>
  );
}

export default NewConversationModal;
