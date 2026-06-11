'use client';

/**
 * Chat Sidebar Component - DRAIS Communication
 * Lists conversations with unread badges, search, filtering, and new chat button
 * Features: Direct & group chats, typing indicators, online status, search
 */

import { useEffect, useState, useRef } from 'react';
import { Plus, Search, X, MessageCircle, Users, Phone, Settings, Archive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ChatSidebar({
  conversations = [],
  selectedConversationId,
  onSelectConversation,
  onCreateNew,
  onSettings,
  onArchive,
  onDelete,
  isLoadingConvs = false,
  showArchived = false,
  onToggleArchived,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredConvs, setFilteredConvs] = useState(conversations);
  const [activeFilter, setActiveFilter] = useState('all'); // all, direct, group, unread
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    let filtered = conversations.filter(
      (conv) =>
        (conv.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (conv.last_sender_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Apply filter
    if (activeFilter === 'direct') {
      filtered = filtered.filter((c) => c.type === 'direct');
    } else if (activeFilter === 'group') {
      filtered = filtered.filter((c) => c.type === 'group' || c.type === 'department');
    } else if (activeFilter === 'unread') {
      filtered = filtered.filter((c) => c.unread_count > 0);
    }

    setFilteredConvs(filtered);
  }, [conversations, searchQuery, activeFilter]);

  const handleContextMenu = (e, convId) => {
    e.preventDefault();
    setContextMenu({ convId, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Messages</h2>
          <div className="flex gap-2">
            {onToggleArchived && (
              <button
                onClick={onToggleArchived}
                className={`p-2 rounded-lg transition ${showArchived ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                title={showArchived ? 'Show active chats' : 'Show archived chats'}
              >
                <Archive className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onCreateNew}
              className="p-2 hover:bg-muted rounded-lg transition text-primary hover:text-primary/80"
              title="Start new conversation"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={onSettings}
              className="p-2 hover:bg-muted rounded-lg transition text-muted-foreground hover:text-foreground"
              title="Communication settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-muted text-foreground text-sm rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {['all', 'direct', 'group', 'unread'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                activeFilter === filter
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingConvs ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-start gap-3 p-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConvs.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm space-y-2">
            <p>
              {conversations.length === 0
                ? showArchived
                  ? 'No archived conversations'
                  : 'No conversations yet. Start one!'
                : 'No conversations match your search'}
            </p>
            {conversations.length === 0 && !showArchived && (
              <button
                onClick={onCreateNew}
                className="text-primary hover:text-primary/80 font-medium text-sm"
              >
                + Start a conversation
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence>
            {filteredConvs.map((conv) => (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onContextMenu={(e) => handleContextMenu(e, conv.id)}
                className={`border-b border-border transition cursor-pointer group ${
                  selectedConversationId === conv.id ? 'bg-muted' : 'hover:bg-muted/50'
                }`}
              >
                <button
                  onClick={() => onSelectConversation(conv.id)}
                  className="w-full px-4 py-3 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Conversation Header */}
                      <div className="flex items-center gap-2 mb-1">
                        {conv.type === 'direct' ? (
                          <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                          <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <h3 className="font-medium text-foreground text-sm truncate">
                          {conv.name || conv.last_sender_name || 'Conversation'}
                        </h3>
                        {conv.unread_count > 0 && (
                          <div className="w-2 h-2 bg-destructive rounded-full shrink-0" />
                        )}
                      </div>

                      {/* Last Message Preview */}
                      <p className="text-xs text-muted-foreground truncate px-6">
                        {conv.last_message || 'No messages yet'}
                      </p>
                    </div>

                    {/* Unread Badge & Time */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {conv.unread_count > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs font-bold">
                          {conv.unread_count > 99 ? '99+' : conv.unread_count}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(conv.last_message_at || conv.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bg-card border border-border rounded-lg shadow-lg z-50"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onMouseLeave={() => setContextMenu(null)}
          >
            <button
              onClick={() => { onArchive?.(contextMenu.convId); setContextMenu(null); }}
              className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
            >
              <Archive className="w-4 h-4" />
              {showArchived ? 'Unarchive' : 'Archive'}
            </button>
            <button
              onClick={() => { onDelete?.(contextMenu.convId); setContextMenu(null); }}
              className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-muted flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ChatSidebar;
