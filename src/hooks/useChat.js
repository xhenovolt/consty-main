'use client';

/**
 * useChat Hook
 * Manages conversation and message state, handles API calls
 */

import { useEffect, useState, useCallback } from 'react';

export function useChat() {
  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingConvs, setIsLoadingConvs] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => setError(null), []);

  // ── Fetch conversations ──
  const fetchConversations = useCallback(async () => {
    setIsLoadingConvs(true);
    try {
      const res = await fetch('/api/communication/conversations?limit=50', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch conversations');
      const data = await res.json();
      setConversations(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingConvs(false);
    }
  }, []);

  // ── Fetch messages for selected conversation ──
  const fetchMessages = useCallback(async (convId) => {
    if (!convId) return;
    setIsLoadingMessages(true);
    try {
      const res = await fetch(
        `/api/communication/${convId}/messages?limit=50`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      setMessages(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // ── Send message ──
  const sendMessage = useCallback(
    async (content, attachment = null) => {
      if (!selectedConvId) throw new Error('No conversation selected');

      try {
        const res = await fetch(
          `/api/communication/${selectedConvId}/messages`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content,
              message_type: attachment ? attachment.type : 'text',
              media_url: attachment?.url,
              media_type: attachment?.type,
              file_name: attachment?.name,
              file_size: attachment?.size,
            }),
          }
        );

        if (!res.ok) throw new Error('Failed to send message');
        const data = await res.json();

        // Add to local messages
        setMessages((prev) => [...prev, data.data]);

        // Update last_message_at in conversations
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === selectedConvId
              ? { ...conv, last_message_at: new Date().toISOString() }
              : conv
          )
        );

        return data.data;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [selectedConvId]
  );

  // ── Create new conversation ──
  const createConversation = useCallback(async (type, name, memberIds) => {
    try {
      const res = await fetch('/api/communication/conversations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name,
          participants: memberIds,
        }),
      });

      if (!res.ok) throw new Error('Failed to create conversation');
      const data = await res.json();

      // If existing, don't add duplicate
      if (!data.data.existing) {
        setConversations((prev) => [data.data, ...prev]);
      }

      setSelectedConvId(data.data.id);
      return data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load messages when conversation selected
  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId);
    }
  }, [selectedConvId, fetchMessages]);

  return {
    // State
    conversations,
    selectedConvId,
    messages,
    isLoadingConvs,
    isLoadingMessages,
    error,

    // Actions
    setSelectedConvId,
    fetchConversations,
    fetchMessages,
    sendMessage,
    createConversation,
    clearError,
  };
}

export default useChat;
