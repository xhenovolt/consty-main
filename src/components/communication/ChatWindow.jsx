'use client';

/**
 * Enhanced Chat Window — WhatsApp-level messaging
 * Features: Emojis, file attachments, image preview, audio recording,
 * message status (sent/delivered/read), typing indicators, media preview
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Send, Paperclip, Image as ImageIcon, X, Check, CheckCheck,
  Smile, Mic, File, Video, ArrowDown, Loader2, Phone, VideoIcon, Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => <div className="w-[320px] h-[350px] bg-muted rounded-xl animate-pulse" />,
});

const STATUS_ICONS = {
  sending: <Loader2 className="w-3 h-3 animate-spin opacity-50" />,
  sent: <Check className="w-3 h-3 opacity-60" />,
  delivered: <CheckCheck className="w-3 h-3 opacity-60" />,
  read: <CheckCheck className="w-3 h-3 text-blue-500" />,
};

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function MediaPreview({ msg }) {
  const [expanded, setExpanded] = useState(false);

  if (msg.message_type === 'image' && msg.media_url) {
    return (
      <>
        <img
          src={msg.media_url}
          alt="Shared image"
          className="max-w-xs rounded-lg max-h-64 object-cover cursor-pointer hover:opacity-90 transition"
          onClick={() => setExpanded(true)}
          loading="lazy"
        />
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
              onClick={() => setExpanded(false)}
            >
              <motion.img
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                src={msg.media_url}
                alt=""
                className="max-w-full max-h-full object-contain rounded-lg"
              />
              <button className="absolute top-4 right-4 p-2 bg-white/10 backdrop-blur rounded-full hover:bg-white/20 transition">
                <X className="w-6 h-6 text-white" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  if (msg.message_type === 'video' && msg.media_url) {
    return (
      <video src={msg.media_url} controls className="max-w-xs rounded-lg max-h-64" preload="metadata" />
    );
  }

  if (msg.message_type === 'audio' && msg.media_url) {
    return (
      <div className="flex items-center gap-2 min-w-[200px]">
        <audio src={msg.media_url} controls className="w-full h-8" preload="metadata" />
      </div>
    );
  }

  if (msg.message_type === 'file' && msg.media_url) {
    return (
      <a
        href={msg.media_url}
        download={msg.file_name}
        className="flex items-center gap-2 px-3 py-2 bg-background/30 rounded-lg hover:bg-background/50 transition"
        target="_blank"
        rel="noopener noreferrer"
      >
        <File className="w-5 h-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{msg.file_name || 'File'}</p>
          {msg.file_size && <p className="text-xs opacity-60">{formatFileSize(msg.file_size)}</p>}
        </div>
        <Download className="w-4 h-4 shrink-0 opacity-60" />
      </a>
    );
  }

  return null;
}

function TypingIndicator({ names = [] }) {
  if (!names.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      className="flex items-center gap-2 px-4 py-1"
    >
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-xs text-muted-foreground italic">
        {names.length === 1 ? `${names[0]} is typing...` : `${names.length} people typing...`}
      </span>
    </motion.div>
  );
}

function AudioRecorder({ onRecorded, onCancel }) {
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach(t => t.stop());
          onRecorded(blob);
        };

        mediaRecorder.start();
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      } catch {
        onCancel();
      }
    })();
    return () => { cancelled = true; clearInterval(timerRef.current); };
  }, []);

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.ondataavailable = () => {};
      mediaRecorderRef.current.onstop = () => {};
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    onCancel();
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 flex-1">
      <button onClick={cancelRecording} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition cursor-pointer">
        <X className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2 flex-1">
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        <span className="text-sm text-foreground font-mono">{formatTime(duration)}</span>
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <motion.div className="h-full bg-red-500" animate={{ width: ['0%', '100%'] }} transition={{ duration: 60, ease: 'linear' }} />
        </div>
      </div>
      <button onClick={stopRecording} className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition cursor-pointer">
        <Send className="w-5 h-5" />
      </button>
    </motion.div>
  );
}

export function ChatWindow({
  conversationId,
  conversationName,
  messages = [],
  currentUserId,
  isLoading = false,
  onSendMessage,
  onLoadMore,
  hasMore = false,
  typingUsers = [],
  onStartCall,
}) {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const [text, setText] = useState('');
  const [isSending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const toast = useToast();

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => { scrollToBottom('auto'); }, [messages.length]);

  const handleScroll = () => {
    const c = messagesContainerRef.current;
    if (!c) return;
    setShowScrollDown(c.scrollHeight - c.scrollTop - c.clientHeight > 100);
  };

  const handleSend = async () => {
    if (!text.trim() && !attachment) return;
    setSending(true);
    try {
      let attachData = null;
      if (attachment) {
        const configRes = await api.post('/api/communication/upload', {
          fileName: attachment.file.name,
          fileType: attachment.file.type,
          fileSize: attachment.file.size,
        }, { silent: true });

        if (configRes.ok) {
          const { cloudName, uploadPreset, folder } = configRes.data;
          if (cloudName && uploadPreset) {
            const formData = new FormData();
            formData.append('file', attachment.file);
            formData.append('upload_preset', uploadPreset);
            formData.append('folder', folder);
            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: 'POST', body: formData });
            const uploadData = await uploadRes.json();
            if (uploadData.secure_url) {
              attachData = { url: uploadData.secure_url, type: attachment.type, name: attachment.file.name, size: attachment.file.size };
            }
          }
        } else {
          toast.error(configRes.error || 'Upload failed');
          setSending(false);
          return;
        }
      }
      await onSendMessage(text, attachData);
      setText('');
      setAttachment(null);
      setShowEmoji(false);
    } catch {
      toast.error('Failed to send message');
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isSending) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setAttachment({
      file, preview,
      type: type || (file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file'),
    });
    setShowAttachMenu(false);
  };

  const handleAudioRecorded = (blob) => {
    const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
    setAttachment({ file, preview: null, type: 'audio' });
    setIsRecording(false);
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-background">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Send className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium mb-1">No conversation selected</p>
          <p className="text-sm">Pick a chat or start a new one</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex-1 p-4 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'} gap-2`}>
              <div className={`animate-pulse rounded-xl px-4 py-3 ${i % 2 === 0 ? 'bg-muted' : 'bg-primary/20'}`}>
                <div className="h-4 w-32 bg-background/30 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground text-sm">{conversationName || 'Chat'}</h3>
          {typingUsers.length > 0 && (
            <p className="text-xs text-primary animate-pulse">
              {typingUsers.length === 1 ? `${typingUsers[0]} is typing...` : 'Several people typing...'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onStartCall && (
            <>
              <button onClick={() => onStartCall('audio')} className="p-2 hover:bg-muted rounded-lg transition text-muted-foreground hover:text-foreground cursor-pointer" title="Voice call">
                <Phone className="w-5 h-5" />
              </button>
              <button onClick={() => onStartCall('video')} className="p-2 hover:bg-muted rounded-lg transition text-muted-foreground hover:text-foreground cursor-pointer" title="Video call">
                <VideoIcon className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-2">
        {hasMore && (
          <button onClick={onLoadMore} className="mx-auto block px-4 py-1.5 text-xs text-primary hover:text-primary/80 transition cursor-pointer">
            Load earlier messages
          </button>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isOwn = String(msg.sender_id) === String(currentUserId);
            const showDate = idx === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[idx - 1]?.created_at).toDateString();
            return (
              <div key={msg.id || idx}>
                {showDate && (
                  <div className="flex items-center justify-center my-3">
                    <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs">
                      {new Date(msg.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} gap-2`}>
                  {!isOwn && (
                    <img
                      src={msg.sender_avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(msg.sender_name || 'U')}&size=32`}
                      alt=""
                      className="w-7 h-7 rounded-full bg-muted shrink-0 mt-1"
                    />
                  )}
                  <div className={`max-w-xs sm:max-w-sm px-3 py-2 rounded-2xl ${
                    isOwn ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card border border-border text-foreground rounded-bl-md'
                  }`}>
                    {!isOwn && msg.sender_name && <p className="text-xs font-semibold mb-0.5 opacity-70">{msg.sender_name}</p>}
                    <MediaPreview msg={msg} />
                    {msg.content && <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>}
                    <div className={`flex items-center gap-1 mt-1 text-[10px] ${isOwn ? 'justify-end opacity-70' : 'text-muted-foreground'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isOwn && (STATUS_ICONS[msg.delivery_status || msg.status || 'sent'])}
                    </div>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </AnimatePresence>

        <AnimatePresence>
          {typingUsers.length > 0 && <TypingIndicator names={typingUsers} />}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll Down */}
      <AnimatePresence>
        {showScrollDown && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => scrollToBottom()}
            className="absolute bottom-24 right-4 p-2 bg-card border border-border rounded-full shadow-lg hover:bg-muted transition cursor-pointer"
          >
            <ArrowDown className="w-5 h-5 text-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Attachment Preview */}
      <AnimatePresence>
        {attachment && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-4 py-2 bg-muted/50 border-t border-border">
            <div className="flex items-center gap-3">
              {attachment.preview ? (
                <img src={attachment.preview} alt="" className="w-16 h-16 rounded-lg object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                  {attachment.type === 'audio' ? <Mic className="w-5 h-5 text-muted-foreground" /> : <File className="w-5 h-5 text-muted-foreground" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{attachment.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(attachment.file.size)}</p>
              </div>
              <button onClick={() => setAttachment(null)} className="p-1.5 hover:bg-background rounded-lg transition cursor-pointer">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmoji && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-20 left-4 z-30">
            <EmojiPicker onEmojiClick={(d) => setText(prev => prev + d.emoji)} theme="auto" height={350} width={320} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="border-t border-border bg-card p-3">
        <div className="flex gap-2 items-end">
          {isRecording ? (
            <AudioRecorder onRecorded={handleAudioRecorded} onCancel={() => setIsRecording(false)} />
          ) : (
            <>
              <button onClick={() => setShowEmoji(!showEmoji)} className={`p-2 rounded-lg transition cursor-pointer ${showEmoji ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                <Smile className="w-5 h-5" />
              </button>

              <div className="relative">
                <button onClick={() => setShowAttachMenu(!showAttachMenu)} className="p-2 hover:bg-muted rounded-lg transition text-muted-foreground hover:text-foreground cursor-pointer">
                  <Paperclip className="w-5 h-5" />
                </button>
                <AnimatePresence>
                  {showAttachMenu && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-xl shadow-lg py-2 min-w-[160px] z-20">
                      <button onClick={() => imageInputRef.current?.click()} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition cursor-pointer">
                        <ImageIcon className="w-4 h-4 text-emerald-500" /> Photo
                      </button>
                      <button onClick={() => { const inp = document.createElement('input'); inp.type='file'; inp.accept='video/*'; inp.onchange=(ev)=>handleFileSelect(ev,'video'); inp.click(); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition cursor-pointer">
                        <Video className="w-4 h-4 text-blue-500" /> Video
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition cursor-pointer">
                        <File className="w-4 h-4 text-orange-500" /> Document
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e, 'file')} />
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'image')} />

              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); setShowEmoji(false); }}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 bg-muted text-foreground rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-primary resize-none max-h-24 text-sm"
                rows={1}
              />

              {text.trim() || attachment ? (
                <button onClick={handleSend} disabled={isSending} className="p-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 transition cursor-pointer active:scale-95">
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              ) : (
                <button onClick={() => setIsRecording(true)} className="p-2 hover:bg-muted rounded-lg transition text-muted-foreground hover:text-foreground cursor-pointer">
                  <Mic className="w-5 h-5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatWindow;
