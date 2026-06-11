'use client';

/**
 * Communication Module — WhatsApp + Google Meet Replacement
 * Full chat interface with staff-based user picker, file sharing, calls, real-time
 */

import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useToast } from '@/components/ui/Toast';
import { ChatSidebar } from '@/components/communication/ChatSidebar';
import { ChatWindow } from '@/components/communication/ChatWindow';
import useChat from '@/hooks/useChat';
import { api, confirmAction } from '@/lib/api-client';
import { PageTransition } from '@/components/ui/PageTransition';

// Lazy load heavy modals — only loaded when user opens them
const NewConversationModal = lazy(() => import('@/components/communication/NewConversationModal').then(m => ({ default: m.NewConversationModal })));
const CallUI = lazy(() => import('@/components/communication/CallUI').then(m => ({ default: m.default })));

export default function CommunicationPage() {
  const toast = useToast();
  const [showNewConvModal, setShowNewConvModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showCallUI, setShowCallUI] = useState(null); // { type: 'audio'|'video', conversationId }
  const [showArchived, setShowArchived] = useState(false);
  const chat = useChat();

  // Fetch current user ID
  useEffect(() => {
    api.get('/api/auth/me', { silent: true }).then(res => {
      if (res.ok && res.data) {
        setCurrentUserId(res.data.id || res.data.user?.id);
      }
    });
  }, []);

  // Show chat errors as toasts — clear error immediately to prevent re-fire
  useEffect(() => {
    if (chat.error) {
      toast.error(chat.error);
      chat.clearError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.error]);

  const handleCreateConversation = useCallback(
    async (type, name, memberIds) => {
      try {
        await chat.createConversation(type, name, memberIds);
        toast.success('Conversation created!');
      } catch (err) {
        toast.error(err.message || 'Failed to create conversation');
        throw err;
      }
    },
    [chat, toast]
  );

  const handleSendMessage = useCallback(
    async (content, attachment) => {
      try {
        await chat.sendMessage(content, attachment);
      } catch (err) {
        toast.error('Failed to send message');
      }
    },
    [chat, toast]
  );

  const handleStartCall = useCallback((type) => {
    if (!chat.selectedConvId) return;
    setShowCallUI({ type, conversationId: chat.selectedConvId });
    toast.info(`Starting ${type} call...`);
    // Call initiation handled by CallUI component
  }, [chat.selectedConvId, toast]);

  // Get selected conversation name
  const selectedConv = chat.conversations.find(c => c.id === chat.selectedConvId);

  // Archive/unarchive handler
  const handleArchive = useCallback(async (convId) => {
    const conv = chat.conversations.find(c => c.id === convId);
    const archiving = !conv?.is_archived;
    const confirmed = await confirmAction(
      archiving ? 'Archive Conversation?' : 'Unarchive Conversation?',
      archiving ? 'This will hide the conversation from your main list.' : 'This will move the conversation back to your main list.',
      archiving ? 'Archive' : 'Unarchive',
      'question'
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/communication/conversations/${convId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: archiving }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(data.message || (archiving ? 'Conversation archived' : 'Conversation unarchived'));
      chat.fetchConversations();
    } catch (err) {
      toast.error(err.message || 'Failed to update conversation');
    }
  }, [chat, toast]);

  // Delete handler
  const handleDelete = useCallback(async (convId) => {
    const confirmed = await confirmAction(
      'Delete Conversation?',
      'This action cannot be undone. All messages will be hidden.',
      'Delete',
      'warning'
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/communication/conversations/${convId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Conversation deleted');
      if (chat.selectedConvId === convId) chat.setSelectedConvId(null);
      chat.fetchConversations();
    } catch (err) {
      toast.error(err.message || 'Failed to delete conversation');
    }
  }, [chat, toast]);

  // Filter conversations based on archived state
  const visibleConversations = chat.conversations.filter(c =>
    showArchived ? c.is_archived : !c.is_archived
  );

  return (
    <PageTransition className="h-screen">
      <div className="flex h-full bg-background">
        {/* Sidebar */}
        <div className="w-80 border-r border-border flex-shrink-0 hidden md:flex flex-col">
          <ChatSidebar
            conversations={visibleConversations}
            selectedConversationId={chat.selectedConvId}
            onSelectConversation={chat.setSelectedConvId}
            onCreateNew={() => setShowNewConvModal(true)}
            onArchive={handleArchive}
            onDelete={handleDelete}
            showArchived={showArchived}
            onToggleArchived={() => setShowArchived(prev => !prev)}
            isLoadingConvs={chat.isLoadingConvs}
          />
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <ChatWindow
            conversationId={chat.selectedConvId}
            conversationName={selectedConv?.name || selectedConv?.last_sender_name}
            messages={chat.messages}
            currentUserId={currentUserId}
            isLoading={chat.isLoadingMessages}
            onSendMessage={handleSendMessage}
            onLoadMore={() => {}}
            onStartCall={handleStartCall}
            typingUsers={[]}
          />
        </div>

        {/* New Conversation Modal */}
        <Suspense fallback={null}>
          <NewConversationModal
            isOpen={showNewConvModal}
            onClose={() => setShowNewConvModal(false)}
            onCreateConversation={handleCreateConversation}
          />
        </Suspense>

        {/* Call UI Overlay */}
        {showCallUI && (
          <Suspense fallback={<div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center text-white">Connecting...</div>}>
          <CallOverlay
            type={showCallUI.type}
            conversationId={showCallUI.conversationId}
            conversationName={selectedConv?.name || 'Call'}
            onEnd={() => setShowCallUI(null)}
          />
          </Suspense>
        )}
      </div>
    </PageTransition>
  );
}

/**
 * CallOverlay — WebRTC call interface
 */
function CallOverlay({ type, conversationId, conversationName, onEnd }) {
  const [callState, setCallState] = useState('connecting'); // connecting, active, ended
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(type === 'audio');

  useEffect(() => {
    // Log call initiation
    api.post('/api/communication/calls', {
      conversation_id: conversationId,
      call_type: type,
    }, { silent: true });

    // Simulate connection (real WebRTC would go here)
    const timer = setTimeout(() => setCallState('active'), 2000);
    return () => clearTimeout(timer);
  }, [conversationId, type]);

  useEffect(() => {
    if (callState !== 'active') return;
    const interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleEnd = () => {
    setCallState('ended');
    onEnd();
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center text-white">
      <div className="text-center mb-8">
        <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold">{conversationName}</h2>
        <p className="text-white/60 mt-1">
          {callState === 'connecting' && 'Connecting...'}
          {callState === 'active' && formatTime(duration)}
          {callState === 'ended' && 'Call ended'}
        </p>
      </div>

      {/* Call Controls */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => setMuted(!muted)}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition cursor-pointer ${muted ? 'bg-white/20' : 'bg-white/10 hover:bg-white/20'}`}
        >
          {muted ? '🔇' : '🎤'}
        </button>
        {type === 'video' && (
          <button
            onClick={() => setVideoOff(!videoOff)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition cursor-pointer ${videoOff ? 'bg-white/20' : 'bg-white/10 hover:bg-white/20'}`}
          >
            {videoOff ? '📷' : '🎥'}
          </button>
        )}
        <button
          onClick={handleEnd}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition cursor-pointer"
        >
          📞
        </button>
      </div>
    </div>
  );
}
