'use client';

import { useEffect } from 'react';

/**
 * Global Error Boundary
 * Replaces the root layout when an unrecoverable error occurs, so it MUST
 * render its own <html> and <body>. Kept intentionally self-contained (no
 * context providers, no routing components) so it can render even when the
 * app shell itself has failed.
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[Consty] Unhandled runtime error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          background: '#0b0b0c',
          color: '#f4f4f5',
          padding: '1rem',
        }}
      >
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#a1a1aa', marginBottom: '0.5rem', lineHeight: 1.6 }}>
            An unexpected error occurred. This has been logged.
          </p>
          {error?.message && (
            <p
              style={{
                fontSize: '0.75rem',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                background: '#18181b',
                border: '1px solid #27272a',
                borderRadius: 8,
                padding: '0.5rem 1rem',
                margin: '0 0 1.5rem',
                textAlign: 'left',
                wordBreak: 'break-all',
                color: '#a1a1aa',
              }}
            >
              {error.message}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              padding: '0.625rem 1.25rem',
              background: '#22c55e',
              color: '#06240f',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
