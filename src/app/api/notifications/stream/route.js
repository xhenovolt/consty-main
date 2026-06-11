import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils.js';
import { getPool } from '@/lib/db.js';

/**
 * GET /api/notifications/stream — Server-Sent Events for real-time notifications
 * Uses PG LISTEN/NOTIFY to push notifications to connected clients
 */
export async function GET(request) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const userId = auth.userId;
  let pgClient = null;
  let heartbeatInterval = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Send initial connected event
      send('connected', { userId, timestamp: new Date().toISOString() });

      // Heartbeat every 25s to keep connection alive
      heartbeatInterval = setInterval(() => {
        if (closed) { clearInterval(heartbeatInterval); return; }
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          closed = true;
          clearInterval(heartbeatInterval);
        }
      }, 25000);

      // Listen for PG notifications
      try {
        const pool = getPool();
        pgClient = await pool.connect();

        await pgClient.query('LISTEN new_notification');

        pgClient.on('notification', (msg) => {
          if (closed) return;
          try {
            const payload = JSON.parse(msg.payload);
            // Only forward notifications for this user
            if (payload.recipient_user_id === userId) {
              send('notification', payload);
            }
          } catch {}
        });

        pgClient.on('error', () => {
          closed = true;
          cleanup();
        });
      } catch (err) {
        console.error('[SSE] PG LISTEN setup failed:', err.message);
        // Fallback: still keep the stream open for heartbeats
        // Client can fall back to polling
        send('error', { message: 'Real-time setup failed, falling back to polling' });
      }

      // Cleanup when stream closes
      function cleanup() {
        closed = true;
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        if (pgClient) {
          pgClient.query('UNLISTEN new_notification').catch(() => {});
          pgClient.release();
          pgClient = null;
        }
      }

      // Handle client disconnect via AbortSignal
      request.signal.addEventListener('abort', () => {
        cleanup();
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
