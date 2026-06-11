'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Send, Reply, Pencil, Trash2, CheckCircle2, CornerDownRight, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { confirmDelete } from '@/lib/confirm';

/**
 * RecordComments — Reusable threaded comments component
 * Drop into any detail page: <RecordComments entityType="deal" entityId={dealId} />
 */
export default function RecordComments({ entityType, entityId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [sending, setSending] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!entityType || !entityId) return;
    try {
      const res = await fetchWithAuth(`/api/comments?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`);
      const data = await res.json();
      if (data.success) setComments(data.data || []);
    } catch {} finally { setLoading(false); }
  }, [entityType, entityId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const submit = async () => {
    if (!content.trim()) return;
    setSending(true);
    try {
      const res = await fetchWithAuth('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          content: content.trim(),
          parent_comment_id: replyTo || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setContent('');
        setReplyTo(null);
        fetchComments();
      }
    } catch {} finally { setSending(false); }
  };

  const updateComment = async (id) => {
    if (!editContent.trim()) return;
    try {
      const res = await fetchWithAuth('/api/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content: editContent.trim() }),
      });
      if ((await res.json()).success) {
        setEditingId(null);
        setEditContent('');
        fetchComments();
      }
    } catch {}
  };

  const resolveComment = async (id) => {
    try {
      const res = await fetchWithAuth('/api/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resolve: true }),
      });
      if ((await res.json()).success) fetchComments();
    } catch {}
  };

  const deleteComment = async (id) => {
    if (!await confirmDelete('comment')) return;
    try {
      const res = await fetchWithAuth(`/api/comments?id=${id}`, { method: 'DELETE' });
      if ((await res.json()).success) fetchComments();
    } catch {}
  };

  const formatTime = (d) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return date.toLocaleDateString('en-UG', { month: 'short', day: 'numeric' });
  };

  const CommentItem = ({ comment, isReply = false }) => (
    <div className={`${isReply ? 'ml-8 pl-3 border-l-2 border-border' : ''} py-3`}>
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 dark:bg-blue-900/30 dark:text-blue-300">
          {comment.author_name?.charAt(0) || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-foreground">{comment.author_name || 'Unknown'}</span>
            <span className="text-xs text-muted-foreground">{formatTime(comment.created_at)}</span>
            {comment.is_edited && <span className="text-xs text-muted-foreground">(edited)</span>}
            {comment.is_resolved && (
              <span className="flex items-center gap-0.5 text-xs text-emerald-600"><CheckCircle2 className="w-3 h-3" />Resolved</span>
            )}
          </div>

          {editingId === comment.id ? (
            <div className="flex gap-2 mt-1">
              <input
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && updateComment(comment.id)}
                className="flex-1 px-3 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm"
                autoFocus
              />
              <button onClick={() => updateComment(comment.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: 'var(--theme-primary, #3b82f6)' }}>Save</button>
              <button onClick={() => { setEditingId(null); setEditContent(''); }} className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted">Cancel</button>
            </div>
          ) : (
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{comment.content}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-1">
            {!isReply && (
              <button
                onClick={() => { setReplyTo(comment.id); setContent(''); }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
              >
                <Reply className="w-3 h-3" /> Reply
              </button>
            )}
            <button
              onClick={() => { setEditingId(comment.id); setEditContent(comment.content); }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
            {!comment.is_resolved && !isReply && (
              <button
                onClick={() => resolveComment(comment.id)}
                className="text-xs text-muted-foreground hover:text-emerald-600 flex items-center gap-0.5"
              >
                <CheckCircle2 className="w-3 h-3" /> Resolve
              </button>
            )}
            <button
              onClick={() => deleteComment(comment.id)}
              className="text-xs text-muted-foreground hover:text-red-500 flex items-center gap-0.5"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Replies */}
      {comment.replies?.map(reply => (
        <CommentItem key={reply.id} comment={reply} isReply />
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MessageSquare className="w-4 h-4" />
        Discussion ({comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0)})
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">No comments yet. Start the discussion.</div>
      ) : (
        <div className="divide-y divide-border">
          {comments.map(c => <CommentItem key={c.id} comment={c} />)}
        </div>
      )}

      {/* Compose */}
      <div className="pt-2">
        {replyTo && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <CornerDownRight className="w-3 h-3" />
            Replying to comment
            <button onClick={() => setReplyTo(null)} className="hover:text-foreground"><X className="w-3 h-3" /></button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submit()}
            placeholder={replyTo ? 'Write a reply...' : 'Add a comment...'}
            className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
          />
          <button
            onClick={submit}
            disabled={!content.trim() || sending}
            className="px-3 py-2 rounded-lg text-white disabled:opacity-50 transition"
            style={{ background: 'var(--theme-primary, #3b82f6)' }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
