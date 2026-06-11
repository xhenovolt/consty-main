/**
 * GET /api/drais/schools/[id]
 * POST /api/drais/schools/[id]/suspend
 * POST /api/drais/schools/[id]/activate
 * PATCH /api/drais/schools/[id]
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import {
  getSchoolById,
  suspendSchool,
  activateSchool,
  updateSchool,
} from '@/lib/draisClient.ts';

/**
 * GET /api/drais/schools/[id]
 * Fetch a specific school
 */
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'drais.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = params;
    const result = await getSchoolById(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[DRAIS] GET /schools/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch school' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/drais/schools/[id]
 * Update school information (pricing, subscription plan, etc)
 */
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'drais.edit');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = params;
    const body = await request.json();

    const result = await updateSchool(id, body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'School updated successfully',
    });
  } catch (error) {
    console.error('[DRAIS] PATCH /schools/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update school' },
      { status: 500 }
    );
  }
}
