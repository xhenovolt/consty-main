/**
 * GET /api/drais/audit-logs
 * 
 * Fetch activity logs from DRAIS showing what schools are doing
 * Supports filtering by date range and school
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { getAuditLogs } from '@/lib/draisClient.ts';

export async function GET(request) {
  const perm = await requirePermission(request, 'drais.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('school_id');
    const range = searchParams.get('range'); // 1h, 24h, 7d
    const limit = searchParams.get('limit') || '50';

    // Calculate date range
    let startDate, endDate;
    const now = new Date();

    switch (range) {
      case '1h':
        startDate = new Date(now.getTime() - 1 * 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default 24h
    }

    endDate = now;

    // Fetch logs from DRAIS
    const result = await getAuditLogs({
      school_id: schoolId || undefined,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      limit: parseInt(limit, 10),
      offset: 0,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data || [],
      range,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      count: (result.data || []).length,
    });
  } catch (error) {
    console.error('[DRAIS] GET /audit-logs error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
