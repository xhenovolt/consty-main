/**
 * POST /api/drais/schools/[id]/suspend
 * 
 * Suspend a school in DRAIS
 * This is a destructive action - requires drais.control permission
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { suspendSchool } from '@/lib/draisClient.ts';
import { dispatch } from '@/lib/system-events.js';

export async function POST(request, { params }) {
  // Require explicit control permission for destructive actions
  const perm = await requirePermission(request, 'drais.control');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = params;
    const { auth } = perm;

    // Call DRAIS to suspend the school
    const result = await suspendSchool(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 503 }
      );
    }

    // Log this action in system events for audit trail
    try {
      await dispatch({
        type: 'DRAIS_SCHOOL_SUSPENDED',
        userId: auth.userId,
        metadata: {
          schoolId: id,
          schoolName: result.data?.name,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (logError) {
      console.warn('[DRAIS] Failed to log suspension event:', logError);
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: `School "${result.data?.name}" has been suspended`,
    });
  } catch (error) {
    console.error('[DRAIS] POST /schools/[id]/suspend error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to suspend school' },
      { status: 500 }
    );
  }
}
