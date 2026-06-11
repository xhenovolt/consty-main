/**
 * GET /api/drais/schools
 * 
 * Fetches all schools from DRAIS with live data
 * Requires: drais.view permission
 * 
 * Query params:
 * - filter: Optional filter string
 * - status: Optional status filter (active, suspended, inactive)
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { getSchools } from '@/lib/draisClient.ts';

export async function GET(request) {
  // Verify authentication and permission
  const perm = await requirePermission(request, 'drais.view');
  if (perm instanceof NextResponse) return perm;

  try {
    // Fetch live data from DRAIS
    const result = await getSchools();

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to fetch schools from DRAIS',
        },
        { status: 503 } // Service Unavailable
      );
    }

    // Optional: Apply client-side filtering if needed
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    let schools = result.data || [];
    if (statusFilter) {
      schools = schools.filter((s) => s.status === statusFilter);
    }

    return NextResponse.json({
      success: true,
      data: schools,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[DRAIS] GET /schools error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while fetching schools',
      },
      { status: 500 }
    );
  }
}
