/**
 * API: Auto-log Issues
 * POST /api/issues/auto-log
 * 
 * Frontend sends error details here, backend stores in `issues` table
 * Returns: { success: true, issue_id: uuid }
 */

import { getCurrentUser } from '@/lib/current-user.js';
import { query } from '@/lib/db.js';
import { logAuthEvent } from '@/lib/audit.js';

export async function POST(request) {
  try {
    // ── 1. Get current user (auto-logged errors might not have user) ──
    const user = await getCurrentUser().catch(() => null);

    // ── 2. Parse request ──
    const body = await request.json();
    const {
      system_id = 'Consty',
      title,
      description,
      severity = 'high',
      source = 'auto',
      error_code,
      error_stack,
      context = {},
    } = body;

    // ── 3. Validate required fields ──
    if (!title) {
      return Response.json(
        { success: false, error: 'title is required' },
        { status: 400 }
      );
    }

    // ── 4. Determine severity (auto escalate critical patterns) ──
    let finalSeverity = severity;
    if (
      title.includes('map is not a function') ||
      title.includes('Cannot read property') ||
      title.includes('undefined is not an object') ||
      title.includes('ReferenceError')
    ) {
      finalSeverity = 'critical';
    }

    // ── 5. Insert into issues table ──
    const result = await query(
      `INSERT INTO issues (
        system_id, title, description, severity, source,
        error_code, error_stack, context,
        reported_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, created_at`,
      [
        system_id,
        title,
        description,
        finalSeverity,
        source,
        error_code,
        error_stack,
        JSON.stringify(context),
        user?.id || null,
      ]
    );

    const issueId = result.rows[0].id;

    // ── 6. Audit log ──
    if (user) {
      await logAuthEvent({
        userId: user.id,
        action: 'ERROR_AUTO_LOGGED',
        entityType: 'issue',
        entityId: issueId,
        details: { severity: finalSeverity, error_code },
      }).catch(() => {
        // Silently fail audit logging
      });
    }

    // ── 7. Create notification for admins if critical ──
    if (finalSeverity === 'critical') {
      // Notify all admins
      await query(
        `INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
         SELECT id, $1, $2, 'issue', 'issue', $3
         FROM users WHERE role IN ('superadmin', 'admin')`,
        [
          `🚨 Critical Error: ${title}`,
          `A critical issue was auto-detected: ${title}. Error ID: ${issueId}`,
          issueId,
        ]
      ).catch(() => {
        // Silently fail notification
      });

      console.error(`[CRITICAL ISSUE LOGGED] ${title} - ID: ${issueId}`);
    }

    return Response.json(
      {
        success: true,
        issue_id: issueId,
        severity: finalSeverity,
        message: 'Error has been logged and our team has been notified',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[auto-log] Error:', error.message);

    // Even if logging fails, don't crash the frontend
    return Response.json(
      {
        success: false,
        error: 'Failed to log error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/issues/auto-log
 * Returns recent auto-logged issues (admin only)
 */
export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user || !['superadmin', 'admin'].includes(user.role)) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const severity = url.searchParams.get('severity');

    let sql = `
      SELECT id, title, severity, source, status, created_at, error_code
      FROM issues
      WHERE source = 'auto'
    `;
    const params = [];

    if (severity) {
      sql += ` AND severity = $${params.length + 1}`;
      params.push(severity);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);

    return Response.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('[auto-log GET] Error:', error.message);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
