/**
 * POST /api/drais/schools/[id]/activate
 * 
 * Activate a suspended school in DRAIS
 * Requires: drais.control permission
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { activateSchool } from '@/lib/draisClient.ts';
import { dispatch } from '@/lib/system-events.js';

export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'drais.control');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = params;
    const { auth } = perm;

    // Call DRAIS to activate the school
    const result = await activateSchool(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 503 }
      );
    }

    // Log this action in system events for audit trail
    try {
      await dispatch({
        type: 'DRAIS_SCHOOL_ACTIVATED',
        userId: auth.userId,
        metadata: {
          schoolId: id,
          schoolName: result.data?.name,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (logError) {
      console.warn('[DRAIS] Failed to log activation event:', logError);
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: `School "${result.data?.name}" has been activated`,
    });
  } catch (error) {
    console.error('[DRAIS] POST /schools/[id]/activate error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to activate school' },
      { status: 500 }
    );
  }
}
