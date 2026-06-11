/**
 * /api/drais-proxy
 * 
 * Secure proxy for all external API calls
 * 
 * This endpoint:
 * 1. Retrieves the active external connection
 * 2. Decrypts credentials
 * 3. Injects credentials into request headers
 * 4. Makes the actual API call
 * 5. Logs the call
 * 6. Returns the response
 * 
 * CRITICAL: API credentials are NEVER sent to frontend
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';
import { decryptSecret } from '@/lib/encryption.js';

/**
 * GET and POST /api/drais-proxy
 * 
 * Query params:
 * - action: The DRAIS action to perform (getSchools, suspendSchool, etc)
 * - id: Optional - school ID for specific operations
 * - rest: Any additional params passed through as query string
 */
export async function GET(request) {
  const perm = await requirePermission(request, 'drais.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { auth } = perm;
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: action' },
        { status: 400 }
      );
    }

    // Get active connection
    const result = await query(
      'SELECT * FROM external_connections WHERE is_active = TRUE AND system_type = $1',
      ['drais']
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active DRAIS connection configured' },
        { status: 503 }
      );
    }

    const connection = result.rows[0];

    // Decrypt credentials
    let api_key, api_secret;
    try {
      api_key = decryptSecret(connection.api_key_encrypted);
      api_secret = decryptSecret(connection.api_secret_encrypted);
    } catch (err) {
      console.error('[DRAIS Proxy] Decryption failed:', err);
      return NextResponse.json(
        { success: false, error: 'Failed to decrypt credentials' },
        { status: 500 }
      );
    }

    // Build remote request based on action
    const remoteUrl = buildRemoteUrl(connection.base_url, action, url.searchParams);

    const startTime = Date.now();
    let statusCode = 500;
    let errorMessage = null;

    try {
      const response = await fetch(remoteUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': api_key,
          'X-API-Secret': api_secret,
        },
        timeout: 30000,
      });

      statusCode = response.status;
      const data = await response.json();

      // Log the call
      await logDRAISCall({
        connection_id: connection.id,
        action,
        method: 'GET',
        endpoint: remoteUrl.replace(connection.base_url, ''),
        status_code: statusCode,
        executed_by: auth.userId,
        response_time: Date.now() - startTime,
      });

      return NextResponse.json(data, { status: statusCode });
    } catch (error) {
      errorMessage = error.message;

      // Log the error
      await logDRAISCall({
        connection_id: connection.id,
        action,
        method: 'GET',
        endpoint: remoteUrl.replace(connection.base_url, ''),
        status_code: statusCode,
        error_message: errorMessage,
        executed_by: auth.userId,
        response_time: Date.now() - startTime,
      });

      console.error('[DRAIS Proxy] Remote call failed:', error);
      return NextResponse.json(
        { success: false, error: 'External API call failed', message: errorMessage },
        { status: statusCode }
      );
    }
  } catch (error) {
    console.error('[DRAIS Proxy] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Proxy error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/drais-proxy
 * 
 * For actions that require POST (control actions)
 */
export async function POST(request) {
  const perm = await requirePermission(request, 'drais.edit');
  if (perm instanceof NextResponse) return perm;

  try {
    const { auth } = perm;
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: action' },
        { status: 400 }
      );
    }

    // Get active connection
    const result = await query(
      'SELECT * FROM external_connections WHERE is_active = TRUE AND system_type = $1',
      ['drais']
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active DRAIS connection configured' },
        { status: 503 }
      );
    }

    const connection = result.rows[0];

    // Decrypt credentials
    let api_key, api_secret;
    try {
      api_key = decryptSecret(connection.api_key_encrypted);
      api_secret = decryptSecret(connection.api_secret_encrypted);
    } catch (err) {
      console.error('[DRAIS Proxy] Decryption failed:', err);
      return NextResponse.json(
        { success: false, error: 'Failed to decrypt credentials' },
        { status: 500 }
      );
    }

    // Get request body
    const body = await request.json();

    // Build remote request
    const remoteUrl = buildRemoteUrl(connection.base_url, action, url.searchParams);

    const startTime = Date.now();
    let statusCode = 500;
    let errorMessage = null;

    try {
      const response = await fetch(remoteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': api_key,
          'X-API-Secret': api_secret,
        },
        body: JSON.stringify(body),
        timeout: 30000,
      });

      statusCode = response.status;
      const data = await response.json();

      // Log the call
      await logDRAISCall({
        connection_id: connection.id,
        action,
        method: 'POST',
        endpoint: remoteUrl.replace(connection.base_url, ''),
        status_code: statusCode,
        executed_by: auth.userId,
        response_time: Date.now() - startTime,
      });

      return NextResponse.json(data, { status: statusCode });
    } catch (error) {
      errorMessage = error.message;

      // Log the error
      await logDRAISCall({
        connection_id: connection.id,
        action,
        method: 'POST',
        endpoint: remoteUrl.replace(connection.base_url, ''),
        status_code: statusCode,
        error_message: errorMessage,
        executed_by: auth.userId,
        response_time: Date.now() - startTime,
      });

      console.error('[DRAIS Proxy] Remote call failed:', error);
      return NextResponse.json(
        { success: false, error: 'External API call failed', message: errorMessage },
        { status: statusCode }
      );
    }
  } catch (error) {
    console.error('[DRAIS Proxy] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Proxy error' },
      { status: 500 }
    );
  }
}

/**
 * Build remote URL based on action
 */
function buildRemoteUrl(baseUrl, action, searchParams) {
  const actionMap = {
    getSchools: '/api/schools',
    getSchool: '/api/schools/:id',
    suspendSchool: '/api/schools/:id/suspend',
    activateSchool: '/api/schools/:id/activate',
    getPricing: '/api/pricing',
    getAuditLogs: '/api/audit-logs',
    getHealth: '/api/control/health',
  };

  let endpoint = actionMap[action];
  if (!endpoint) {
    throw new Error(`Unknown action: ${action}`);
  }

  // Replace :id placeholder
  const id = searchParams.get('id');
  if (id && endpoint.includes(':id')) {
    endpoint = endpoint.replace(':id', id);
  }

  // Build full URL
  const url = new URL(endpoint, baseUrl);

  // Add other query params
  for (const [key, value] of searchParams) {
    if (key !== 'action' && key !== 'id') {
      url.searchParams.append(key, value);
    }
  }

  return url.toString();
}

/**
 * Log DRAIS call to audit table
 */
async function logDRAISCall({
  connection_id,
  action,
  method,
  endpoint,
  status_code,
  error_message,
  executed_by,
  response_time,
}) {
  try {
    await query(
      `INSERT INTO external_connection_logs
       (connection_id, action, method, endpoint, status_code, error_message, executed_by, response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [connection_id, action, method, endpoint, status_code, error_message || null, executed_by, response_time]
    );
  } catch (err) {
    console.warn('[DRAIS Proxy] Failed to log call:', err);
  }
}
