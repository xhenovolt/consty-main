/**
 * POST /api/integrations/test
 * 
 * Test a connection with given credentials
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';

/**
 * Test connection endpoint
 * Input: { base_url, api_key, api_secret }
 * Returns: { success, message, response_time }
 */
export async function POST(request) {
  const perm = await requirePermission(request, 'integrations.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const body = await request.json();
    const { base_url, api_key, api_secret } = body;

    // Validate input
    if (!base_url || !api_key || !api_secret) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: base_url, api_key, api_secret' },
        { status: 400 }
      );
    }

    // Validate URL format
    let url;
    try {
      url = new URL(base_url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid base_url format' },
        { status: 400 }
      );
    }

    // Build test endpoint URL
    const testUrl = new URL('/api/control/ping', base_url).toString();

    // Make request with credentials
    const startTime = Date.now();

    try {
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': api_key,
          'X-API-Secret': api_secret,
        },
        body: JSON.stringify({}),
        timeout: 10000, // 10 second timeout
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          success: true,
          message: 'Connection verified',
          status_code: response.status,
          response_time: responseTime,
          data,
        });
      } else {
        const data = await response.text();
        return NextResponse.json({
          success: false,
          error: `Remote server returned ${response.status}`,
          message: data.substring(0, 200),
          status_code: response.status,
          response_time: responseTime,
        });
      }
    } catch (fetchErr) {
      const responseTime = Date.now() - startTime;

      // Check error type
      if (fetchErr.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          error: 'Request timeout',
          message: 'Connection test exceeded 10 seconds',
          response_time: responseTime,
        });
      }

      return NextResponse.json({
        success: false,
        error: fetchErr.message,
        message: 'Could not reach remote server',
        response_time: responseTime,
      });
    }
  } catch (error) {
    console.error('[Integrations] Test error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test connection' },
      { status: 500 }
    );
  }
}
