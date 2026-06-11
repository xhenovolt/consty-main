/**
 * GET /api/drais/health
 * 
 * Check if DRAIS API is accessible
 * Useful for monitoring and status dashboards
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { healthCheck } from '@/lib/draisClient.ts';

export async function GET(request) {
  // Allow minimal auth for health checks (could be public or require auth)
  const perm = await requirePermission(request, 'drais.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const result = await healthCheck();

    return NextResponse.json({
      success: result.success,
      status: result.data?.status || 'unknown',
      error: result.error,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[DRAIS] GET /health error:', error);
    return NextResponse.json(
      {
        success: false,
        status: 'unavailable',
        error: 'DRAIS API unreachable',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
