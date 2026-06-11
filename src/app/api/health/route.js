import { testConnection } from '@/lib/db.js';

/**
 * GET /api/health
 *
 * Health check endpoint that validates:
 * - Server is running
 * - Database connection is active
 * - Current timestamp
 */
export async function GET() {
  try {
    // Test database connection
    const isConnected = await testConnection();

    return Response.json(
      {
        status: isConnected ? 'ok' : 'degraded',
        database: isConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      {
        status: isConnected ? 200 : 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Health check error:', error);

    return Response.json(
      {
        status: 'error',
        database: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}
